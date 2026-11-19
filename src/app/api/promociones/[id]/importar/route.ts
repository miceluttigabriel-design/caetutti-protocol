import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";
import {
  ensurePromocionesTables,
  insertarContactosEnLotes,
  normalizarContactosEntrantes,
  type ContactoParaInsertar,
} from "@/lib/promociones-db";
import { parsearExcelPromociones } from "@/lib/promociones-excel";
import { deduplicarPorTelefono } from "@/lib/promociones";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/promociones/[id]/importar
 * Agrega más contactos a una campaña existente.
 *
 * - JSON:    { contactos: [...] }  ← el panel lee el Excel y manda tandas
 * - FormData con `file`            ← compatibilidad con archivos chicos
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) return unauthorized();
  await ensurePromocionesTables();
  const { id } = await params;

  const promocion = await db.promocion.findFirst({
    where: { id, empresaId: user.empresaId },
    select: { id: true },
  });
  if (!promocion) return fail("Campaña no encontrada", 404);

  const esJson = (req.headers.get("content-type") || "").includes("application/json");
  let nuevas: ContactoParaInsertar[] = [];
  let sinNombre = 0;

  if (esJson) {
    const body = await req.json().catch(() => ({}));
    nuevas = normalizarContactosEntrantes(body.contactos);
  } else {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return fail("Subí el Excel con los contactos");

    const ext = file.name.toLowerCase().split(".").pop();
    if (!["xlsx", "xls", "csv"].includes(ext || "")) {
      return fail("El archivo tiene que ser .xlsx, .xls o .csv");
    }

    const parseo = parsearExcelPromociones(await file.arrayBuffer());
    if (parseo.filas.length === 0) {
      return fail("No se encontraron contactos válidos en el archivo");
    }
    sinNombre = parseo.sinNombre;
    const dedup = deduplicarPorTelefono(parseo.filas);
    nuevas = dedup.filas.map((f) => ({
      nombre: f.nombre,
      telefono: f.telefono,
      telefonoNormalizado: f.telefonoNormalizado,
      modelo: f.modelo,
      localidad: f.localidad,
      ci: f.ci,
      notas: f.notas,
    }));
  }

  if (nuevas.length === 0) return fail("No se encontraron contactos válidos en el archivo");

  // Duplicados: solo consultamos los teléfonos de ESTE lote (no los 70.000).
  const telefonos = nuevas
    .map((n) => n.telefonoNormalizado)
    .filter((t): t is string => Boolean(t));

  const existentes = telefonos.length
    ? await db.promocionContacto.findMany({
        where: { promocionId: id, telefonoNormalizado: { in: telefonos } },
        select: { telefonoNormalizado: true },
      })
    : [];
  const yaEstan = new Set(existentes.map((c) => c.telefonoNormalizado));

  const vistos = new Set<string>();
  const filtradas = nuevas.filter((n) => {
    if (!n.telefonoNormalizado) return true;
    if (yaEstan.has(n.telefonoNormalizado) || vistos.has(n.telefonoNormalizado)) return false;
    vistos.add(n.telefonoNormalizado);
    return true;
  });

  if (filtradas.length === 0) {
    return ok({ agregados: 0, repetidos: nuevas.length, total: 0 });
  }

  await insertarContactosEnLotes(id, filtradas);

  const total = await db.promocionContacto.count({ where: { promocionId: id } });
  await db.promocion.update({ where: { id }, data: { totalContactos: total } });

  return ok({
    agregados: filtradas.length,
    repetidos: nuevas.length - filtradas.length,
    total,
    sinNombre,
  });
}
