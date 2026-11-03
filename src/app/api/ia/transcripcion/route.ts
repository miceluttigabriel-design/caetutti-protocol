import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";
import { transcribirAudio } from "@/lib/ia";

/**
 * POST /api/ia/transcripcion
 * Body: { mensajeId: string, audioBase64: string, mimeType?: string }
 * Transcribe un audio usando el proveedor configurado (por ahora Gemini, abierto para futuro).
 */
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const body = await req.json();
  const { mensajeId, audioBase64, mimeType } = body;

  if (!audioBase64) return fail("audioBase64 requerido");
  if (!mensajeId) return fail("mensajeId requerido");

  const msg = await db.mensaje.findFirst({
    where: {
      id: mensajeId,
      conversacion: { empresaId: user.empresaId },
    },
  });
  if (!msg) return fail("Mensaje no encontrado", 404);

  const resultado = await transcribirAudio(user.empresaId, audioBase64, mimeType || "audio/ogg");

  if (resultado.texto) {
    await db.mensaje.update({
      where: { id: mensajeId },
      data: { transcripcion: resultado.texto },
    });
  }

  return ok(resultado);
}
