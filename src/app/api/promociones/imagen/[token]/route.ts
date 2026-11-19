import { NextRequest } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/promociones/imagen/[token]
 *
 * URL pública de la imagen de una campaña. Es pública a propósito: Meta y
 * Datafy descargan la foto desde sus servidores para mandarla por WhatsApp.
 * El token es largo y aleatorio, así que no se puede adivinar.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token || token.length < 20) {
    return new Response("No encontrada", { status: 404 });
  }

  try {
    const promo = await db.promocion.findFirst({
      where: { imagenToken: token },
      select: { imagenBase64: true, imagenMime: true, imagenNombre: true },
    });

    if (!promo?.imagenBase64) {
      return new Response("No encontrada", { status: 404 });
    }

    const bytes = Buffer.from(promo.imagenBase64, "base64");
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": promo.imagenMime || "image/jpeg",
        "Content-Length": String(bytes.length),
        "Content-Disposition": `inline; filename="${(promo.imagenNombre || "promo.jpg").replace(/"/g, "")}"`,
        // El token cambia cada vez que se sube otra imagen, así que es seguro
        // cachear para siempre: WhatsApp no vuelve a pedirla.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("No encontrada", { status: 404 });
  }
}
