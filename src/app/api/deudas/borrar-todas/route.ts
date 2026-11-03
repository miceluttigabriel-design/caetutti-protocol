import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";

/**
 * DELETE /api/deudas/borrar-todas
 * Borra TODAS las deudas (cuotas) de la empresa.
 * Los clientes se PRESERVAN.
 * También borra notificaciones y logs relacionados con esas cuotas.
 *
 * Query: ?confirmar=true (requerido para ejecutar)
 */
export async function DELETE(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();
  if (user.rol !== "admin") {
    return fail("Solo admin puede borrar deudas", 403);
  }

  const { searchParams } = new URL(req.url);
  const confirmar = searchParams.get("confirmar") === "true";
  if (!confirmar) {
    return fail("Confirmación requerida. Use ?confirmar=true", 400);
  }

  // Contar antes de borrar
  const totalCuotas = await db.cuota.count({ where: { empresaId: user.empresaId } });
  const totalNotifs = await db.notificacion.count({ where: { empresaId: user.empresaId } });
  const totalLogs = await db.metaMensajeLog.count({ where: { empresaId: user.empresaId } });

  // Borrar en orden (respetando foreign keys)
  // 1. Notificaciones
  await db.notificacion.deleteMany({ where: { empresaId: user.empresaId } });
  // 2. Promesas de pago
  await db.recordatorio.deleteMany({ where: { empresaId: user.empresaId } });
  // 3. Mensajes y conversaciones
  await db.mensaje.deleteMany({
    where: { conversacion: { empresaId: user.empresaId } },
  });
  await db.conversacion.deleteMany({ where: { empresaId: user.empresaId } });
  // 4. Contactos del día
  await db.contactoDia.deleteMany({ where: { empresaId: user.empresaId } });
  // 5. MetaMensajeLog
  await db.metaMensajeLog.deleteMany({ where: { empresaId: user.empresaId } });
  // 6. MetaUsoMensual
  await db.metaUsoMensual.deleteMany({ where: { empresaId: user.empresaId } });
  // 7. Cuotas (DEUDAS) — esto es lo que se borra
  await db.cuota.deleteMany({ where: { empresaId: user.empresaId } });

  // Verificar que los clientes se preservaron
  const clientesRestantes = await db.cliente.count({ where: { empresaId: user.empresaId } });

  return ok({
    borrado: {
      deudas: totalCuotas,
      notificaciones: totalNotifs,
      logs: totalLogs,
    },
    clientesPreservados: clientesRestantes,
    mensaje: `${totalCuotas} deudas borradas. ${clientesRestantes} clientes preservados.`,
  });
}
