import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized, sucursalFilter } from "@/lib/session";
import { ensurePromocionesTables, insertarContactosEnLotes } from "@/lib/promociones-db";
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

  return ok({ promociones });
}

/**
 * POST /api/promociones — crea la campaña y carga los contactos del Excel.
 * Body: FormData { nombre, mensaje, descripcion?, modoEnvio?, sucursalId?, file }
 */
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();
  await ensurePromocionesTables();

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const nombre = String(formData.get("nombre") || "").trim();
  const mensaje = String(formData.get("mensaje") || "").trim();
  const descripcion = String(formData.get("descripcion") || "").trim() || null;
  const modoEnvioRaw = String(formData.get("modoEnvio") || "api");
  const modoEnvio = MODOS_ENVIO.some((m) => m.key === modoEnvioRaw) ? modoEnvioRaw : "api";
  const sucursalId = String(formData.get("sucursalId") || "").trim() || null;

  if (!nombre) return fail("Poné un nombre a la campaña");
  if (!mensaje) return fail("El mensaje no puede estar vacío");
  if (!file) return fail("Subí el Excel con los contactos");

  const ext = file.name.toLowerCase().split(".").pop();
  if (!["xlsx", "xls", "csv"].includes(ext || "")) {
    return fail("El archivo tiene que ser .xlsx, .xls o .csv");
  }

  const buffer = await file.arrayBuffer();
  const parseo = parsearExcelPromociones(buffer);

  if (parseo.filas.length === 0) {
    return fail(
      "No se encontraron contactos. Revisá que el Excel tenga una columna de nombre y otra de teléfono."
    );
  }

  const { filas, duplicados } = deduplicarPorTelefono(parseo.filas);

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

  // En lotes: un Excel de 100.000 filas no entra en un solo INSERT.
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
      sinNombre: parseo.sinNombre,
      sinTelefono: parseo.sinTelefono,
      columnas: parseo.columnas,
    },
    201
  );
}
