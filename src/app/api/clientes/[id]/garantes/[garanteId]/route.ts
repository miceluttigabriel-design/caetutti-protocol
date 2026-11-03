import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";
import { normalizarTelefonoPY } from "@/lib/meta";

/**
 * PUT /api/clientes/[id]/garantes/[garanteId]
 * Actualiza un garante existente.
 *
 * Body: {
 *   garanteNombre?: string,
 *   garanteTelefono?: string,   // "" = sin teléfono
 *   garanteCi?: string,
 *   garanteParentesco?: string,
 *   notas?: string,
 * }
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; garanteId: string }> }
) {
  const user = await getSession();
  if (!user) return unauthorized();
  const { id, garanteId } = await params;
  const body = await req.json();

  const { garanteNombre, garanteTelefono, garanteCi, garanteParentesco, notas } = body;

  // Verificar que el garante exista y pertenezca a la empresa
  const existente = await db.garante.findFirst({
    where: { id: garanteId, clienteId: id, empresaId: user.empresaId },
  });
  if (!existente) return fail("Garante no encontrado", 404);

  const nombreLimpio = garanteNombre !== undefined ? String(garanteNombre).trim() : existente.garanteNombre;
  if (!nombreLimpio) {
    return fail("El nombre del garante es obligatorio");
  }

  // Normalizar teléfono si viene, si viene "" → null (sin teléfono)
  let telNorm = existente.garanteTelefono;
  if (garanteTelefono !== undefined) {
    const telLimpio = String(garanteTelefono).trim();
    telNorm = telLimpio ? normalizarTelefonoPY(telLimpio) : null;
  }

  const garante = await db.garante.update({
    where: { id: garanteId },
    data: {
      garanteNombre: nombreLimpio,
      garanteTelefono: telNorm,
      garanteCi: garanteCi !== undefined ? (String(garanteCi).trim() || null) : existente.garanteCi,
      garanteParentesco: garanteParentesco !== undefined ? (String(garanteParentesco).trim() || null) : existente.garanteParentesco,
      notas: notas !== undefined ? (String(notas).trim() || null) : existente.notas,
    },
  });

  return ok({
    garante,
    msg: telNorm
      ? "Garante actualizado correctamente"
      : "Garante actualizado sin teléfono — podés editarlo después",
  });
}

/**
 * DELETE /api/clientes/[id]/garantes/[garanteId]
 * Elimina un garante (soft delete — marca activo=false, no borra el registro).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; garanteId: string }> }
) {
  const user = await getSession();
  if (!user) return unauthorized();
  const { id, garanteId } = await params;

  const existente = await db.garante.findFirst({
    where: { id: garanteId, clienteId: id, empresaId: user.empresaId },
  });
  if (!existente) return fail("Garante no encontrado", 404);

  // Soft delete: marcar como inactivo (no borrar el registro para mantener historial)
  await db.garante.update({
    where: { id: garanteId },
    data: { activo: false },
  });

  return ok({ msg: "Garante eliminado correctamente" });
}
