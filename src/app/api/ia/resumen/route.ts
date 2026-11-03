import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";
import { generarResumenConversacion } from "@/lib/ia";

/**
 * POST /api/ia/resumen
 * Body: { conversacionId: string }
 * Genera un resumen de la conversación con IA y detecta compromisos de pago.
 */
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const body = await req.json();
  const { conversacionId } = body;
  if (!conversacionId) return fail("conversacionId requerido");

  const conv = await db.conversacion.findFirst({
    where: { id: conversacionId, empresaId: user.empresaId },
    include: {
      mensajes: {
        orderBy: { createdAt: "asc" },
        take: 100, // últimos 100 mensajes
      },
    },
  });

  if (!conv) return fail("Conversación no encontrada", 404);

  const resultado = await generarResumenConversacion(
    conv.mensajes.map((m) => ({
      esEntrante: m.esEntrante,
      contenido: m.contenido,
      transcripcion: m.transcripcion || undefined,
    }))
  );

  // Actualizar conversación con el resumen
  await db.conversacion.update({
    where: { id: conv.id },
    data: {
      resumenIA: resultado.resumen,
      compromisoDetectado: resultado.compromisoDetectado,
      fechaCompromiso: resultado.fechaCompromiso,
    },
  });

  // Si detectó compromiso, crear recordatorio automático
  if (resultado.compromisoDetectado && resultado.fechaCompromiso && conv.clienteId) {
    await db.recordatorio.create({
      data: {
        empresaId: user.empresaId,
        clienteId: conv.clienteId,
        fechaCompromiso: resultado.fechaCompromiso,
        descripcion: `Compromiso detectado por IA: ${resultado.resumen}`,
        estado: "pendiente",
        creadoPor: user.id,
      },
    });
  }

  return ok({ resultado });
}
