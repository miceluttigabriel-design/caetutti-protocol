import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";
import { normalizarTelefonoPY } from "@/lib/meta";

/**
 * PUT /api/codeudores/[id]
 * Edita un codeudor existente
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return unauthorized();
  const { id } = await params;
  const body = await req.json();

  const { nombre, telefono, ci, parentesco, activo } = body;

  // Verificar que el codeudor pertenece a un cliente de la empresa
  const codeudor = await db.codeudor.findUnique({
    where: { id },
    include: { cliente: { select: { empresaId: true } } },
  });
  if (!codeudor || codeudor.cliente.empresaId !== user.empresaId) {
    return fail("Codeudor no encontrado", 404);
  }

  const updated = await db.codeudor.update({
    where: { id },
    data: {
      ...(nombre !== undefined && { nombre: String(nombre).trim() }),
      ...(telefono !== undefined && { telefono: normalizarTelefonoPY(String(telefono)) }),
      ...(ci !== undefined && { ci: ci ? String(ci).trim() : null }),
      ...(parentesco !== undefined && { parentesco: parentesco ? String(parentesco).trim() : null }),
      ...(activo !== undefined && { activo: !!activo }),
    },
  });

  return ok({ codeudor: updated });
}

/**
 * DELETE /api/codeudores/[id]
 * Elimina un codeudor
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return unauthorized();
  const { id } = await params;

  // Verificar que pertenece a la empresa
  const codeudor = await db.codeudor.findUnique({
    where: { id },
    include: { cliente: { select: { empresaId: true } } },
  });
  if (!codeudor || codeudor.cliente.empresaId !== user.empresaId) {
    return fail("Codeudor no encontrado", 404);
  }

  await db.codeudor.delete({ where: { id } });
  return ok({ success: true });
}
