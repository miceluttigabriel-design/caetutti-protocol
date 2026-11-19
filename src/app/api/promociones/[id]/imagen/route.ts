import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";
import { ensurePromocionesTables, promocionPublica } from "@/lib/promociones-db";
import { IMAGEN_MIMES } from "@/lib/promociones-imagen";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB

/**
 * POST /api/promociones/[id]/imagen
 * Body: FormData { file }
 *
 * Guarda la imagen de la campaña en la base (base64) y le asigna un token
 * público para que WhatsApp la pueda descargar al enviar.
 * Es opcional: una campaña puede no tener imagen.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) return unauthorized();
  await ensurePromocionesTables();
  const { id } = await params;

  const promocion = await db.promocion.findFirst({
    where: { id, empresaId: user.empresaId },
    select: { id: true },
  });
  if (!promocion) return fail("Campaña no encontrada", 404);

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return fail("No llegó ninguna imagen");

  if (!(IMAGEN_MIMES as readonly string[]).includes(file.type)) {
    return fail("La imagen tiene que ser JPG, PNG o WebP");
  }
  if (file.size > MAX_BYTES) {
    return fail("La imagen pesa más de 4 MB. Probá con una más chica.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0) return fail("La imagen está vacía");

  // Token largo y random: es la única llave de la URL pública.
  const token = `${Date.now().toString(36)}${crypto.randomUUID().replace(/-/g, "")}`;

  const actualizada = await db.promocion.update({
    where: { id },
    data: {
      imagenToken: token,
      imagenMime: file.type,
      imagenNombre: file.name.slice(0, 200) || "promo.jpg",
      imagenBase64: buffer.toString("base64"),
    },
  });

  return ok({ promocion: promocionPublica(actualizada) });
}

/** DELETE /api/promociones/[id]/imagen — saca la imagen de la campaña. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) return unauthorized();
  await ensurePromocionesTables();
  const { id } = await params;

  const promocion = await db.promocion.findFirst({
    where: { id, empresaId: user.empresaId },
    select: { id: true },
  });
  if (!promocion) return fail("Campaña no encontrada", 404);

  const actualizada = await db.promocion.update({
    where: { id },
    data: {
      imagenToken: null,
      imagenMime: null,
      imagenNombre: null,
      imagenBase64: null,
    },
  });

  return ok({ promocion: promocionPublica(actualizada) });
}
