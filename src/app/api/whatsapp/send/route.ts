import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";
import { enviarMensajeTexto, enviarTemplate, construirComponentesTemplate } from "@/lib/meta";

/**
 * POST /api/whatsapp/send
 *
 * Body: {
 *   telefono: string,
 *   mensaje: string,         // modo "texto" (dentro de ventana 24h)
 *   templateNombre?: string, // si se usa template
 *   idioma?: string,         // default "es"
 *   variables?: Record<string, string|number>,  // variables para template
 *   clienteId?: string,
 * }
 */
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const body = await req.json();
  const { telefono, mensaje, templateNombre, idioma, variables, clienteId } = body;

  if (!telefono) return fail("telefono requerido");
  if (!templateNombre && !mensaje) return fail("mensaje o templateNombre requerido");

  const config = await db.configEmpresa.findUnique({
    where: { empresaId: user.empresaId },
  });
  if (!config) return fail("Configuración no encontrada", 500);

  // === MODO MANUAL: no envía por API, solo registra en DB ===
  // El usuario abre WhatsApp con wa.me link y envía manualmente
  if (body.modoManual) {
    // Buscar o crear conversación
    let conversacion = await db.conversacion.findFirst({
      where: { telefono, empresaId: user.empresaId },
    });
    if (!conversacion && clienteId) {
      const cliente = await db.cliente.findFirst({
        where: { id: clienteId, empresaId: user.empresaId },
      });
      conversacion = await db.conversacion.create({
        data: {
          empresaId: user.empresaId,
          telefono,
          clienteId,
          nombreWa: cliente?.entidad || null,
          estado: "activa",
          ultimoMensaje: new Date(),
          noLeidos: 0,
        },
      });
    } else if (conversacion) {
      conversacion = await db.conversacion.update({
        where: { id: conversacion.id },
        data: { ultimoMensaje: new Date(), estado: "activa" },
      });
    }

    // Crear mensaje saliente en la conversación
    if (conversacion) {
      await db.mensaje.create({
        data: {
          conversacionId: conversacion.id,
          waId: `manual_${Date.now()}`,
          tipo: "text",
          contenido: mensaje || `[Template: ${templateNombre}]`,
          esEntrante: false,
          estado: "enviado_manual",
        },
      });
    }

    // Registrar notificación
    if (clienteId) {
      await db.notificacion.create({
        data: {
          empresaId: user.empresaId,
          clienteId,
          telefono,
          mensaje: mensaje || `[Template: ${templateNombre}]`,
          tipo: "individual",
          estado: "enviada",
          enviadoPor: user.id,
        },
      });
      if (body.cuotaIds?.length) {
        await db.cuota.updateMany({
          where: { id: { in: body.cuotaIds } },
          data: { notificado: true, ultimaNotificacion: new Date() },
        });
      }
      await db.contactoDia.create({
        data: {
          empresaId: user.empresaId,
          usuarioId: user.id,
          clienteId,
          telefono,
          tipo: "whatsapp",
          notas: "Envío manual vía wa.me",
        },
      });
    }
    return ok({ success: true, modoManual: true, msg: "Mensaje registrado (envío manual)" });
  }

  // === MODO API: envío automático por Datafy/Meta ===
  let result;
  if (templateNombre) {
    const { componentes } = construirComponentesTemplate(
      mensaje || "",
      variables || {}
    );
    result = await enviarTemplate(
      config,
      telefono,
      templateNombre,
      idioma || "es",
      componentes
    );
  } else {
    result = await enviarMensajeTexto(config, telefono, mensaje);
  }

  if (result.success) {
    // Buscar o crear conversación para que aparezca en Comunicaciones
    let conversacion = await db.conversacion.findFirst({
      where: { telefono, empresaId: user.empresaId },
    });
    if (!conversacion && clienteId) {
      const cliente = await db.cliente.findFirst({
        where: { id: clienteId, empresaId: user.empresaId },
      });
      conversacion = await db.conversacion.create({
        data: {
          empresaId: user.empresaId,
          telefono,
          clienteId,
          nombreWa: cliente?.entidad || null,
          estado: "activa",
          ultimoMensaje: new Date(),
          noLeidos: 0,
        },
      });
    } else if (conversacion) {
      conversacion = await db.conversacion.update({
        where: { id: conversacion.id },
        data: { ultimoMensaje: new Date(), estado: "activa" },
      });
    }

    // Crear mensaje saliente en la conversación (para que aparezca en Comunicaciones)
    if (conversacion) {
      await db.mensaje.create({
        data: {
          conversacionId: conversacion.id,
          waId: result.messageId,
          tipo: "text",
          contenido: mensaje || `[Template: ${templateNombre}]`,
          esEntrante: false,
          estado: "enviado",
        },
      });
    }

    // Registrar notificación en el sistema
    if (clienteId) {
      await db.notificacion.create({
        data: {
          empresaId: user.empresaId,
          clienteId,
          telefono,
          mensaje: mensaje || `[Template: ${templateNombre}]`,
          tipo: "individual",
          estado: "enviada",
          enviadoPor: user.id,
        },
      });
      // Marca cuotas como notificadas si se pasaron cuotaIds
      if (body.cuotaIds?.length) {
        await db.cuota.updateMany({
          where: { id: { in: body.cuotaIds } },
          data: { notificado: true, ultimaNotificacion: new Date() },
        });
      }
      // Registra contacto del día
      await db.contactoDia.create({
        data: {
          empresaId: user.empresaId,
          usuarioId: user.id,
          clienteId,
          telefono,
          tipo: "whatsapp",
        },
      });
    }
    return ok({ success: true, messageId: result.messageId, costo: result.costoEstimado });
  } else {
    return fail(result.error || "Error al enviar", 500);
  }
}
