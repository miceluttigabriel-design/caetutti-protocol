import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";

// GET /api/conversaciones — lista conversaciones activas
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const estado = searchParams.get("estado") || "activa"; // activa | cerrada

  const conversaciones = await db.conversacion.findMany({
    where: { empresaId: user.empresaId, estado },
    include: {
      cliente: { select: { codigoEntidad: true, entidad: true } },
      _count: { select: { mensajes: true } },
    },
    orderBy: { ultimoMensaje: "desc" },
  });

  return ok({ conversaciones });
}

// POST /api/conversaciones — crea conversación (al enviar primer mensaje)
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const body = await req.json();
  const { telefono, clienteId, nombreWa, contenido } = body;

  if (!telefono || !contenido) {
    return fail("telefono y contenido son requeridos");
  }

  // Find or create conversation
  let conv = await db.conversacion.findFirst({
    where: { telefono, empresaId: user.empresaId },
  });

  if (!conv) {
    conv = await db.conversacion.create({
      data: {
        empresaId: user.empresaId,
        telefono,
        clienteId: clienteId || null,
        nombreWa: nombreWa || null,
        estado: "activa",
        ultimoMensaje: new Date(),
      },
    });
  } else if (conv.estado === "cerrada") {
    await db.conversacion.update({
      where: { id: conv.id },
      data: { estado: "activa", ultimoMensaje: new Date() },
    });
  }

  // Create outgoing message
  const msg = await db.mensaje.create({
    data: {
      conversacionId: conv.id,
      tipo: "text",
      contenido,
      esEntrante: false,
      estado: "enviado",
    },
  });

  await db.conversacion.update({
    where: { id: conv.id },
    data: { ultimoMensaje: new Date() },
  });

  return ok({ conversacion: conv, mensaje: msg });
}
