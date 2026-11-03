import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";
import { normalizarTelefonoPY } from "@/lib/meta";

/**
 * GET /api/clientes/[id]/codeudores
 * Lista todos los codeudores de un cliente
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return unauthorized();
  const { id } = await params;

  const codeudores = await db.codeudor.findMany({
    where: { clienteId: id },
    orderBy: { createdAt: "asc" },
  });

  return ok({ codeudores });
}

/**
 * POST /api/clientes/[id]/codeudores
 * Agrega un nuevo codeudor al cliente
 * Body: { nombre, telefono, ci?, parentesco? }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return unauthorized();
  const { id } = await params;
  const body = await req.json();

  const { nombre, telefono, ci, parentesco } = body;
  if (!nombre || !telefono) {
    return fail("nombre y telefono son requeridos");
  }

  // Verificar que el cliente pertenece a la empresa
  const cliente = await db.cliente.findFirst({
    where: { id, empresaId: user.empresaId },
  });
  if (!cliente) return fail("Cliente no encontrado", 404);

  const telNorm = normalizarTelefonoPY(String(telefono));

  const codeudor = await db.codeudor.create({
    data: {
      clienteId: id,
      nombre: String(nombre).trim(),
      telefono: telNorm,
      ci: ci ? String(ci).trim() : null,
      parentesco: parentesco ? String(parentesco).trim() : null,
    },
  });

  return ok({ codeudor });
}
