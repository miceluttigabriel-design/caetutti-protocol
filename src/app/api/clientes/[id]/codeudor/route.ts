import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";
import { normalizarTelefonoPY } from "@/lib/meta";

/**
 * PUT /api/clientes/[id]/codeudor
 * Registra o actualiza el codeudor de un cliente.
 *
 * Body: {
 *   codeudorNombre: string,
 *   codeudorTelefono?: string,   // puede ser vacío — el codeudor se mantiene sin teléfono
 *   codeudorCi?: string,
 *   codeudorParentesco?: string  // ej: "Esposo/a", "Padre", "Hermano/a"
 * }
 *
 * Reglas:
 *   - Si codeudorNombre Y codeudorTelefono son ambos vacíos/null → se ELIMINA el codeudor
 *   - Si codeudorNombre tiene valor pero codeudorTelefono es vacío → se guarda sin teléfono
 *   - Si codeudorTelefono tiene valor pero codeudorNombre es vacío → error (nombre es obligatorio)
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return unauthorized();
  const { id } = await params;
  const body = await req.json();

  const { codeudorNombre, codeudorTelefono, codeudorCi, codeudorParentesco } = body;

  const nombreLimpio = codeudorNombre ? String(codeudorNombre).trim() : "";
  const telefonoLimpio = codeudorTelefono ? String(codeudorTelefono).trim() : "";

  // === Caso 1: Ambos vacíos → eliminar codeudor ===
  if (!nombreLimpio && !telefonoLimpio) {
    const cliente = await db.cliente.update({
      where: { id, empresaId: user.empresaId },
      data: {
        codeudorNombre: null,
        codeudorTelefono: null,
        codeudorCi: null,
        codeudorParentesco: null,
      },
    });
    return ok({ cliente, msg: "Codeudor eliminado" });
  }

  // === Caso 2: Nombre vacío pero teléfono presente → error ===
  if (!nombreLimpio) {
    return fail("El nombre del codeudor es obligatorio");
  }

  // === Caso 3: Nombre presente → guardar codeudor (con o sin teléfono) ===
  // Normalizar teléfono si tiene valor, si no, guardarlo como null
  const telNorm = telefonoLimpio ? normalizarTelefonoPY(telefonoLimpio) : null;

  const cliente = await db.cliente.update({
    where: { id, empresaId: user.empresaId },
    data: {
      codeudorNombre: nombreLimpio,
      codeudorTelefono: telNorm,
      codeudorCi: codeudorCi ? String(codeudorCi).trim() : null,
      codeudorParentesco: codeudorParentesco ? String(codeudorParentesco).trim() : null,
    },
  });

  return ok({
    cliente,
    msg: telNorm ? "Codeudor guardado" : "Codeudor guardado sin teléfono — seguís pudiendo editarlo después",
  });
}

/**
 * DELETE /api/clientes/[id]/codeudor
 * Elimina el codeudor del cliente.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return unauthorized();
  const { id } = await params;

  const cliente = await db.cliente.update({
    where: { id, empresaId: user.empresaId },
    data: {
      codeudorNombre: null,
      codeudorTelefono: null,
      codeudorCi: null,
      codeudorParentesco: null,
    },
  });

  return ok({ cliente, msg: "Codeudor eliminado" });
}
