import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";
import { normalizarTelefonoPY } from "@/lib/meta";

/**
 * GET /api/clientes/[id]/garantes
 * Lista todos los garantes activos de un cliente.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return unauthorized();
  const { id } = await params;

  const garantes = await db.garante.findMany({
    where: { clienteId: id, empresaId: user.empresaId, activo: true },
    orderBy: { createdAt: "asc" },
  });

  return ok({ garantes });
}

/**
 * POST /api/clientes/[id]/garantes
 * Agrega un nuevo garante al cliente.
 *
 * Body: {
 *   garanteNombre: string,        // obligatorio
 *   garanteTelefono?: string,     // opcional
 *   garanteCi?: string,           // opcional
 *   garanteParentesco?: string,   // opcional
 *   notas?: string,               // opcional
 * }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return unauthorized();
  const { id } = await params;
  const body = await req.json();

  const { garanteNombre, garanteTelefono, garanteCi, garanteParentesco, notas } = body;

  const nombreLimpio = garanteNombre ? String(garanteNombre).trim() : "";
  if (!nombreLimpio) {
    return fail("El nombre del garante es obligatorio");
  }

  // Normalizar teléfono si viene
  const telLimpio = garanteTelefono ? String(garanteTelefono).trim() : "";
  const telNorm = telLimpio ? normalizarTelefonoPY(telLimpio) : null;

  // Verificar que el cliente exista y pertenezca a la empresa
  const cliente = await db.cliente.findFirst({
    where: { id, empresaId: user.empresaId },
    select: { id: true },
  });
  if (!cliente) return fail("Cliente no encontrado", 404);

  const garante = await db.garante.create({
    data: {
      empresaId: user.empresaId,
      clienteId: id,
      garanteNombre: nombreLimpio,
      garanteTelefono: telNorm,
      garanteCi: garanteCi ? String(garanteCi).trim() : null,
      garanteParentesco: garanteParentesco ? String(garanteParentesco).trim() : null,
      notas: notas ? String(notas).trim() : null,
      activo: true,
    },
  });

  return ok({
    garante,
    msg: telNorm
      ? "Garante agregado correctamente"
      : "Garante agregado sin teléfono — podés editarlo después",
  });
}
