import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";
import { ensurePromocionesTables } from "@/lib/promociones-db";
import { aplicarVariables } from "@/lib/promociones";
import { enviarMensajeTexto, enviarImagenWhatsapp } from "@/lib/meta";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** URL pública base para que WhatsApp pueda descargar la imagen. */
function urlBase(req: NextRequest): string {
  const configurada = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configurada) return configurada;
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  return `${proto}://${host}`;
}

/**
 * POST /api/promociones/[id]/enviar
 * Body: { limite?: number }
 *
 * Manda los próximos N contactos pendientes por la API de WhatsApp y devuelve
 * el resumen. El panel llama a este endpoint en tandas para mostrar progreso
 * sin pasarse del tiempo máximo de Vercel.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) return unauthorized();
  await ensurePromocionesTables();
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const limite = Math.min(Math.max(Number(body.limite) || 10, 1), 30);

  const promocion = await db.promocion.findFirst({
    where: { id, empresaId: user.empresaId },
  });
  if (!promocion) return fail("Campaña no encontrada", 404);

  if (promocion.modoEnvio !== "api") {
    return fail(
      "Esta campaña está en modo manual o copiar/pegar. Cambiala a “Automático (API)” para enviar desde acá.",
      400
    );
  }

  const config = await db.configEmpresa.findUnique({ where: { empresaId: user.empresaId } });
  if (!config) {
    return fail("Primero configurá el WhatsApp en Configuración → WhatsApp", 400);
  }

  const pendientes = await db.promocionContacto.findMany({
    where: { promocionId: id, estado: "pendiente", telefonoNormalizado: { not: null } },
    orderBy: { createdAt: "asc" },
    take: limite,
  });

  let enviados = 0;
  let errores = 0;

  // Si la campaña tiene imagen, se manda como foto con el texto al pie.
  const imagenUrl = promocion.imagenToken
    ? `${urlBase(req)}/api/promociones/imagen/${promocion.imagenToken}`
    : null;

  for (const contacto of pendientes) {
    const mensaje = aplicarVariables(promocion.mensaje, {
      nombre: contacto.nombre,
      modelo: contacto.modelo,
      localidad: contacto.localidad,
      ci: contacto.ci,
    });

    try {
      const r = imagenUrl
        ? await enviarImagenWhatsapp(config, contacto.telefonoNormalizado!, imagenUrl, mensaje)
        : await enviarMensajeTexto(config, contacto.telefonoNormalizado!, mensaje);

      if (r.success) {
        enviados++;
        await db.promocionContacto.update({
          where: { id: contacto.id },
          data: { estado: "enviado", enviadoAt: new Date(), errorDetalle: null },
        });
      } else {
        errores++;
        await db.promocionContacto.update({
          where: { id: contacto.id },
          data: { estado: "error", errorDetalle: (r as any).error || "Error de envío" },
        });
      }
    } catch (e: any) {
      errores++;
      await db.promocionContacto.update({
        where: { id: contacto.id },
        data: { estado: "error", errorDetalle: e?.message || "Error inesperado" },
      });
    }
  }

  // Contadores calculados desde la base, así nunca quedan desfasados.
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

  return ok({
    procesados: pendientes.length,
    enviados,
    errores,
    pendientes: restantes,
    terminado: restantes === 0,
    total: totalContactos,
  });
}
