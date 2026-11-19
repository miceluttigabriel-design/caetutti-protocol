import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized, sucursalFilter } from "@/lib/session";
import { ensurePromocionesTables, insertarContactosEnLotes, normalizarContactosEntrantes } from "@/lib/promociones-db";
import { parsearExcelPromociones } from "@/lib/promociones-excel";
import { MODOS_ENVIO, deduplicarPorTelefono } from "@/lib/promociones";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/promociones — lista de campañas con sus contadores. */
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();
  await ensurePromocionesTables();

  const { searchParams } = new URL(req.url);
  const sucursal = searchParams.get("sucursal");

  const where: any = { empresaId: user.empresaId, ...sucursalFilter(user) };
  if (sucursal && sucursal !== "__TODAS__") where.sucursalId = sucursal;

  const promociones = await db.promocion.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  // Contadores reales por estado (los omitidos no son "pendientes").
  const grupos = promociones.length
    ? await db.promocionContacto.groupBy({
        by: ["promocionId", "estado"],
        where: { promocionId: { in: promociones.map((p) => p.id) } },
        _count: { _all: true },
      })
    : [];

  const porPromo = new Map<string, Record<string, number>>();
  for (const g of grupos) {
    const fila = porPromo.get(g.promocionId) || {};
    fila[g.estado] = g._count._all;
    porPromo.set(g.promocionId, fila);
  }

  return ok({
    promociones: promociones.map((p) => {
      const c = porPromo.get(p.id) || {};
      return {
        ...p,
        pendientes: c.pendiente || 0,
        omitidos: c.omitido || 0,
        enviados: c.enviado ?? p.enviados,
        errores: c.error ?? p.errores,
      };
    }),
  });
}

/**
 * POST /api/promociones
 *
 * Acepta dos formatos:
 *  1. JSON: { nombre, mensaje, ..., contactos: [...] }  ← el que usa el panel
 *     (el Excel se lee en el navegador y se manda en tandas chicas).
 *  2. multipart con `file` ← compatibilidad para archivos chicos.
 */
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();
  await ensurePromocionesTables();

  const esJson = (req.headers.get("content-type") || "").includes("application/json");

  let nombre = "";
  let mensaje = "";
  let descripcion: string | null = null;
  let modoEnvioRaw = "api";
  let sucursalId: string | null = null;
  let filas: ReturnType<typeof normalizarContactosEntrantes> = [];
  let duplicados = 0;
  let sinNombre = 0;
  let sinTelefono = 0;
  let columnas: string[] = [];

  if (esJson) {
    const body = await req.json().catch(() => ({}));
    nombre = String(body.nombre || "").trim();
    mensaje = String(body.mensaje || "").trim();
    descripcion = String(body.descripcion || "").trim() || null;
    modoEnvioRaw = String(body.modoEnvio || "api");
    sucursalId = String(body.sucursalId || "").trim() || null;
    filas = normalizarContactosEntrantes(body.contactos);

    if (filas.length === 0) return fail("El archivo no tenía contactos válidos");
  } else {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    nombre = String(formData.get("nombre") || "").trim();
    mensaje = String(formData.get("mensaje") || "").trim();
    descripcion = String(formData.get("descripcion") || "").trim() || null;
    modoEnvioRaw = String(formData.get("modoEnvio") || "api");
    sucursalId = String(formData.get("sucursalId") || "").trim() || null;

    if (!file) return fail("Subí el Excel con los contactos");
    const ext = file.name.toLowerCase().split(".").pop();
    if (!["xlsx", "xls", "csv"].includes(ext || "")) {
      return fail("El archivo tiene que ser .xlsx, .xls o .csv");
    }

    const parseo = parsearExcelPromociones(await file.arrayBuffer());
    if (parseo.filas.length === 0) {
      return fail(
        "No se encontraron contactos. Revisá que el Excel tenga una columna de nombre y otra de teléfono."
      );
    }
    const dedup = deduplicarPorTelefono(parseo.filas);
    filas = dedup.filas.map((f) => ({
      nombre: f.nombre,
      telefono: f.telefono,
      telefonoNormalizado: f.telefonoNormalizado,
      modelo: f.modelo,
      localidad: f.localidad,
      ci: f.ci,
      notas: f.notas,
    }));
    duplicados = dedup.duplicados;
    sinNombre = parseo.sinNombre;
    sinTelefono = parseo.sinTelefono;
    columnas = parseo.columnas;
  }

  if (!nombre) return fail("Poné un nombre a la campaña");
  if (!mensaje) return fail("El mensaje no puede estar vacío");

  const modoEnvio = MODOS_ENVIO.some((m) => m.key === modoEnvioRaw) ? modoEnvioRaw : "api";

  const promocion = await db.promocion.create({
    data: {
      empresaId: user.empresaId,
      sucursalId,
      nombre,
      descripcion,
      mensaje,
      modoEnvio,
      estado: "borrador",
      totalContactos: 0,
      creadoPor: user.name,
    },
  });

  await insertarContactosEnLotes(promocion.id, filas);
  await db.promocion.update({
    where: { id: promocion.id },
    data: { totalContactos: filas.length },
  });

  return ok(
    {
      promocion: { ...promocion, totalContactos: filas.length },
      importados: filas.length,
      duplicados,
      sinNombre,
      sinTelefono,
      columnas,
    },
    201
  );
}
