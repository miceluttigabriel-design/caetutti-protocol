import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";
import { ensurePromocionesTables, insertarContactosEnLotes } from "@/lib/promociones-db";
import { parsearExcelPromociones } from "@/lib/promociones-excel";
import { deduplicarPorTelefono } from "@/lib/promociones";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/promociones/[id]/importar
 * Agrega más contactos a una campaña existente desde otro Excel.
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

  // Teléfonos que ya están en la campaña (para no duplicar).
  const existentes = await db.promocionContacto.findMany({
    where: { promocionId: id },
    select: { telefono: true, telefonoNormalizado: true },
  });
  const yaEstan = new Set(
    existentes.map((c) => (c.telefonoNormalizado || c.telefono).replace(/\D/g, ""))
  );

  const { filas } = deduplicarPorTelefono(parseo.filas);
  const nuevas = filas.filter(
    (f) => !yaEstan.has((f.telefonoNormalizado || f.telefono).replace(/\D/g, ""))
  );

  if (nuevas.length === 0) {
    return fail("Todos los contactos del archivo ya estaban en la campaña", 409);
  }

  await insertarContactosEnLotes(id, nuevas);

  const total = await db.promocionContacto.count({ where: { promocionId: id } });
  await db.promocion.update({ where: { id }, data: { totalContactos: total } });

  return ok({ agregados: nuevas.length, total, sinNombre: parseo.sinNombre });
}
