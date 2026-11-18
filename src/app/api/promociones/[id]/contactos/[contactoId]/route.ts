import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";
import { ensurePromocionesTables } from "@/lib/promociones-db";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/promociones/[id]/contactos/[contactoId]
 * Marca un contacto como enviado (modo manual) o lo vuelve a pendiente.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contactoId: string }> }
) {
  const user = await getSession();
  if (!user) return unauthorized();
  await ensurePromocionesTables();
  const { id, contactoId } = await params;

  const promocion = await db.promocion.findFirst({
    where: { id, empresaId: user.empresaId },
    select: { id: true },
  });
  if (!promocion) return fail("Campaña no encontrada", 404);

  const body = await req.json().catch(() => ({}));
  const estado = String(body.estado || "enviado");
  if (!["pendiente", "enviado", "omitido"].includes(estado)) {
    return fail("Estado inválido");
  }

  const contacto = await db.promocionContacto.findFirst({
    where: { id: contactoId, promocionId: id },
    select: { id: true },
  });
  if (!contacto) return fail("Contacto no encontrado", 404);

  await db.promocionContacto.update({
    where: { id: contactoId },
    data: {
      estado,
      enviadoAt: estado === "enviado" ? new Date() : null,
      errorDetalle: null,
    },
  });

  const [totalContactos, totalEnviados, totalErrores, restantes] = await Promise.all([
    db.promocionContacto.count({ where: { promocionId: id } }),
    db.promocionContacto.count({ where: { promocionId: id, estado: "enviado" } }),
    db.promocionContacto.count({ where: { promocionId: id, estado: "error" } }),
    db.promocionContacto.count({ where: { promocionId: id, estado: "pendiente" } }),
  ]);

  await db.promocion.update({
    where: { id },
    data: {
      totalContactos,
      enviados: totalEnviados,
      errores: totalErrores,
      estado: restantes > 0 ? "enviando" : "finalizada",
    },
  });

  return ok({ success: true, enviados: totalEnviados, pendientes: restantes });
}
