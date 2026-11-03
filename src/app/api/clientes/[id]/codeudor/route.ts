import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";
import { normalizarTelefonoPY } from "@/lib/meta";

/**
 * PUT /api/clientes/[id]/codeudor
 * Registra o actualiza el codeudor de un cliente titular.
 *
 * ⚡ NUEVO: además de guardar los campos codeudor* en el titular,
 *    crea (o actualiza) un registro en la tabla Cliente para que el
 *    codeudor aparezca como entidad propia en la pestaña Clientes.
 *
 * Body: {
 *   codeudorNombre: string,
 *   codeudorTelefono?: string,   // puede ser vacío
 *   codeudorCi?: string,
 *   codeudorParentesco?: string
 * }
 *
 * Reglas:
 *   - Ambos vacíos (nombre + teléfono) → eliminar codeudor (campos del titular + entidad)
 *   - Nombre vacío pero teléfono presente → error
 *   - Nombre presente → guardar codeudor
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
    // Limpiar campos del titular
    const titular = await db.cliente.findUnique({
      where: { id },
      select: { codigoEntidad: true, empresaId: true },
    });

    await db.cliente.update({
      where: { id, empresaId: user.empresaId },
      data: {
        codeudorNombre: null,
        codeudorTelefono: null,
        codeudorCi: null,
        codeudorParentesco: null,
      },
    });

    // Eliminar la entidad codeudor (si existe)
    if (titular) {
      const codigoCodeudor = `GAR-${titular.codigoEntidad}`;
      await db.cliente
        .deleteMany({ where: { empresaId: user.empresaId, codigoEntidad: codigoCodeudor } })
        .catch(() => {});
    }

    return ok({ msg: "Codeudor eliminado" });
  }

  // === Caso 2: Nombre vacío pero teléfono presente → error ===
  if (!nombreLimpio) {
    return fail("El nombre del codeudor es obligatorio");
  }

  // === Caso 3: Guardar codeudor ===
  const telNorm = telefonoLimpio ? normalizarTelefonoPY(telefonoLimpio) : null;
  const ciLimpio = codeudorCi ? String(codeudorCi).trim() : null;
  const parentescoLimpio = codeudorParentesco ? String(codeudorParentesco).trim() : null;

  // 1) Actualizar campos del titular (compatibilidad hacia atrás)
  const titularActualizado = await db.cliente.update({
    where: { id, empresaId: user.empresaId },
    data: {
      codeudorNombre: nombreLimpio,
      codeudorTelefono: telNorm,
      codeudorCi: ciLimpio,
      codeudorParentesco: parentescoLimpio,
    },
  });

  // 2) Crear o actualizar la entidad Cliente del codeudor
  //    codigoEntidad = "GAR-{codigoTitular}" (único por empresa)
  const codigoCodeudor = `GAR-${titularActualizado.codigoEntidad}`;
  const nombreMayus = nombreLimpio.toUpperCase();

  try {
    const existente = await db.cliente.findUnique({
      where: {
        empresaId_codigoEntidad: {
          empresaId: user.empresaId,
          codigoEntidad: codigoCodeudor,
        },
      },
      select: { id: true },
    });

    if (existente) {
      // Actualizar datos del codeudor existente
      await db.cliente.update({
        where: { id: existente.id },
        data: {
          entidad: nombreMayus,
          telefono: telNorm,
          ciEntidad: ciLimpio,
          sucursalId: titularActualizado.sucursalId,
          vendedor: titularActualizado.vendedor,
          cobrador: titularActualizado.cobrador,
        },
      });
    } else {
      // Crear el codeudor como entidad Cliente nueva
      await db.cliente.create({
        data: {
          empresaId: user.empresaId,
          codigoEntidad: codigoCodeudor,
          entidad: nombreMayus,
          telefono: telNorm,
          ciEntidad: ciLimpio,
          sucursalId: titularActualizado.sucursalId,
          vendedor: titularActualizado.vendedor,
          cobrador: titularActualizado.cobrador,
          estadoRegistro: "completo",
        },
      });
    }
  } catch (e: any) {
    // Si falla la creación de la entidad, no rompemos el flujo principal:
    // el codeudor ya quedó guardado en los campos del titular.
    console.error("[codeudor] No se pudo crear entidad Cliente:", e.message);
  }

  return ok({
    cliente: titularActualizado,
    msg: telNorm
      ? "Codeudor guardado y registrado como entidad"
      : "Codeudor guardado (sin teléfono) y registrado como entidad",
  });
}

/**
 * DELETE /api/clientes/[id]/codeudor
 * Elimina el codeudor del titular y su entidad asociada.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return unauthorized();
  const { id } = await params;

  const titular = await db.cliente.findUnique({
    where: { id, empresaId: user.empresaId },
    select: { codigoEntidad: true },
  });

  await db.cliente.update({
    where: { id, empresaId: user.empresaId },
    data: {
      codeudorNombre: null,
      codeudorTelefono: null,
      codeudorCi: null,
      codeudorParentesco: null,
    },
  });

  // Eliminar la entidad codeudor (si existe)
  if (titular) {
    const codigoCodeudor = `GAR-${titular.codigoEntidad}`;
    await db.cliente
      .deleteMany({ where: { empresaId: user.empresaId, codigoEntidad: codigoCodeudor } })
      .catch(() => {});
  }

  return ok({ msg: "Codeudor eliminado" });
}
