import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, unauthorized } from "@/lib/session";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ telefono: string }> }) {
  const user = await getSession();
  if (!user) return unauthorized();
  const { telefono } = await params;

  const conv = await db.conversacion.findFirst({
    where: { telefono, empresaId: user.empresaId },
    include: {
      cliente: true,
      mensajes: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!conv) return ok({ conversacion: null });

  // Marca como leídos
  await db.conversacion.update({
    where: { id: conv.id },
    data: { noLeidos: 0 },
  });

  return ok({ conversacion: { ...conv, noLeidos: 0 } });
}
