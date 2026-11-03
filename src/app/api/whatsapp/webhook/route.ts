import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { procesarWebhookDatafy } from "@/lib/datafy";

/**
 * Webhook de Meta Cloud API — RECIBE mensajes y status updates.
 *
 * URL pública: https://gestor-cobro.codeart.com.py/api/whatsapp/webhook?empresaId=<EMP_ID>
 *
 * Configuración en Meta App Dashboard:
 *   - Callback URL: la URL completa de arriba
 *   - Verify Token: el que configures en ConfigEmpresa.metaVerifyToken
 *   - Subscribed fields: messages, message_status, message_delivered, message_read
 */

// GET — Verificación del webhook por Meta/Datafy
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && challenge) {
    // Buscar empresa por verify token O por webhook secret
    const config = await db.configEmpresa.findFirst({
      where: {
        OR: [
          { metaVerifyToken: token },
          { metaWebhookSecret: token },
        ],
      },
    });
    if (config) {
      return new Response(challenge, { status: 200 });
    }
    // Si no encuentra en BD, aceptar igual (Datafy maneja su propio verify)
    return new Response(challenge, { status: 200 });
  }
  return new Response("Bad Request", { status: 400 });
}

// POST — Recibe mensajes y status updates (Meta Cloud API o Datafy)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // === Intentar procesar como Datafy primero (formato event+data) ===
    const datafyMsg = procesarWebhookDatafy(body);
    if (datafyMsg && datafyMsg.telefonoFrom) {
      // Buscar empresa por configuración Datafy
      const config = await db.configEmpresa.findFirst({
        where: { whatsappProveedor: "datafy", datafyApiKey: { not: null } },
      });
      if (config) {
        await procesarMensajeEntranteUnificado(
          config.empresaId,
          datafyMsg.telefonoFrom,
          datafyMsg.mensajeTexto || "",
          datafyMsg.tipoMensaje || "text",
          datafyMsg.messageId,
          datafyMsg.mediaId
        );
      }
      return Response.json({ ok: true });
    }

    // === Formato Meta Cloud API nativo ===
    if (body.object !== "whatsapp_business_account") {
      return Response.json({ ok: true });
    }

    for (const entry of body.entry || []) {
      const wabaId = entry.id;
      // Buscar empresa por WABA ID
      const config = await db.configEmpresa.findFirst({
        where: { metaWabaId: wabaId },
      });
      if (!config) continue;

      for (const change of entry.changes || []) {
        const value = change.value;
        const field = change.field;

        // === smb_app_state_sync: sincronización de estado de la app ===
        if (field === "smb_app_state_sync" || field === "smb_message_echoes") {
          // Procesar ecos de mensajes enviados desde la app del teléfono
          if (value.messages?.length) {
            for (const msg of value.messages) {
              // Los ecos son mensajes enviados DESDE el teléfono
              // Los guardamos como mensajes salientes en la conversación
              await procesarEcoMensaje(config.empresaId, msg, value);
            }
          }
          continue;
        }

        // === Mensaje entrante ===
        if (value.messages?.length) {
          for (const msg of value.messages) {
            await procesarMensajeEntrante(config.empresaId, msg, value);
          }
        }

        // === Status update (delivered, read, etc.) ===
        if (value.statuses?.length) {
          for (const status of value.statuses) {
            await procesarStatusUpdate(config.empresaId, status);
          }
        }
      }
    }

    return Response.json({ ok: true });
  } catch (e: any) {
    console.error("[webhook] Error:", e);
    return Response.json({ ok: true }); // siempre responder 200 para que no reintente
  }
}

// Procesa mensaje entrante unificado (Datafy o Meta)
async function procesarMensajeEntranteUnificado(
  empresaId: string,
  telefonoFrom: string,
  texto: string,
  tipo: string,
  messageId?: string,
  mediaId?: string
) {
  // Normalizar teléfono
  let telefono = telefonoFrom;
  if (telefono.startsWith("595")) telefono = "0" + telefono.slice(3);

  // Buscar o crear conversación
  let conv = await db.conversacion.findFirst({
    where: { telefono, empresaId },
  });
  if (!conv) {
    const cliente = await db.cliente.findFirst({
      where: { telefono, empresaId },
    });
    conv = await db.conversacion.create({
      data: {
        empresaId,
        telefono,
        clienteId: cliente?.id || null,
        estado: "activa",
        ultimoMensaje: new Date(),
        noLeidos: 1,
      },
    });
  } else {
    conv = await db.conversacion.update({
      where: { id: conv.id },
      data: {
        ultimoMensaje: new Date(),
        noLeidos: { increment: 1 },
        estado: "activa",
      },
    });
  }

  // Guardar mensaje
  await db.mensaje.create({
    data: {
      conversacionId: conv.id,
      waId: messageId,
      tipo,
      contenido: texto || `[${tipo}]`,
      mediaUrl: mediaId,
      esEntrante: true,
      estado: "recibido",
    },
  });

  // Incrementar contador de recibidos en uso mensual
  const mes = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  await db.metaUsoMensual.upsert({
    where: { empresaId_anhoMes: { empresaId, anhoMes: mes } },
    update: { recibidos: { increment: 1 } },
    create: { empresaId, anhoMes: mes, recibidos: 1 },
  });

  // === AUTO-RESPONDER con notificación de cobranza ===
  try {
    await autoResponderCobranza(empresaId, telefono, conv.id);
  } catch (e) {
    console.error("[webhook] Error en auto-respuesta:", e);
  }
}

async function procesarMensajeEntrante(empresaId: string, msg: any, value: any) {
  const telefonoFrom = msg.from; // número que envió
  const msgType = msg.type;
  const waId = msg.id;

  // Normalizar teléfono (sin prefijo de país)
  let telefono = telefonoFrom;
  if (telefono.startsWith("595")) telefono = "0" + telefono.slice(3);

  // Buscar o crear conversación
  let conv = await db.conversacion.findFirst({
    where: { telefono, empresaId },
  });
  if (!conv) {
    // Buscar cliente por teléfono
    const cliente = await db.cliente.findFirst({
      where: { telefono, empresaId },
    });
    conv = await db.conversacion.create({
      data: {
        empresaId,
        telefono,
        clienteId: cliente?.id || null,
        nombreWa: value.contacts?.[0]?.profile?.name || null,
        estado: "activa",
        ultimoMensaje: new Date(),
        noLeidos: 1,
      },
    });
  } else {
    conv = await db.conversacion.update({
      where: { id: conv.id },
      data: {
        ultimoMensaje: new Date(),
        noLeidos: { increment: 1 },
        estado: "activa",
      },
    });
  }

  // Extraer contenido según tipo
  let contenido = "";
  let mediaUrl: string | null = null;
  let tipo = "text";

  if (msgType === "text") {
    contenido = msg.text?.body || "";
  } else if (msgType === "audio") {
    tipo = "audio";
    mediaUrl = msg.audio?.id || null;
    contenido = "[Audio recibido]";
  } else if (msgType === "image") {
    tipo = "image";
    mediaUrl = msg.image?.id || null;
    contenido = msg.image?.caption || "[Imagen]";
  } else if (msgType === "document") {
    tipo = "document";
    mediaUrl = msg.document?.id || null;
    contenido = `[Documento: ${msg.document?.filename || ""}]`;
  } else if (msgType === "button") {
    contenido = `[Botón: ${msg.button?.text || ""}]`;
  } else if (msgType === "interactive") {
    contenido = `[Interactivo: ${JSON.stringify(msg.interactive)}]`;
  } else {
    contenido = `[${msgType}]`;
  }

  // Guardar mensaje
  await db.mensaje.create({
    data: {
      conversacionId: conv.id,
      waId,
      tipo,
      contenido,
      mediaUrl,
      esEntrante: true,
      estado: "recibido",
    },
  });

  // Incrementar contador de recibidos en uso mensual
  const mes = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  await db.metaUsoMensual.upsert({
    where: { empresaId_anhoMes: { empresaId, anhoMes: mes } },
    update: { recibidos: { increment: 1 } },
    create: { empresaId, anhoMes: mes, recibidos: 1 },
  });

  // === AUTO-RESPONDER con notificación de cobranza ===
  try {
    await autoResponderCobranza(empresaId, telefono, conv.id);
  } catch (e) {
    console.error("[webhook] Error en auto-respuesta:", e);
  }
}

// ============================================================
// AUTO-RESPONDER: cuando un cliente escribe, se le responde
// automáticamente con su notificación de cobranza
// ============================================================
// Para evitar múltiples notificaciones al mismo cliente en el mismo día,
// el sistema solo envía UNA notificación automática por ventana de 24 horas.
async function autoResponderCobranza(empresaId: string, telefono: string, conversacionId: string) {
  // === COOLDOWN DE 24 HORAS: una sola notificación automática por día ===
  const cooldownMs = 24 * 60 * 60 * 1000; // 24 horas
  const cooldownDesde = new Date(Date.now() - cooldownMs);

  // Buscar si el sistema ya envió una auto-respuesta en las últimas 24h
  // Identificamos los mensajes del sistema porque empiezan con "Estimado/a"
  // (los mensajes tuyos desde el celular no empiezan así, son ecos que se guardan diferente)
  const ultimaNotificacionSistema = await db.mensaje.findFirst({
    where: {
      conversacionId,
      esEntrante: false,
      createdAt: { gte: cooldownDesde },
      contenido: { startsWith: "Estimado/a" },
    },
    orderBy: { createdAt: "desc" },
  });

  if (ultimaNotificacionSistema) {
    const proximaVentana = new Date(ultimaNotificacionSistema.createdAt.getTime() + cooldownMs);
    console.log(`[webhook] Auto-respuesta omitida para ${telefono} (ya notificado ${ultimaNotificacionSistema.createdAt.toISOString()}). Próxima ventana: ${proximaVentana.toISOString()}`);
    return;
  }

  // Buscar el cliente por teléfono
  const cliente = await db.cliente.findFirst({
    where: { telefono, empresaId },
    include: {
      cuotas: {
        where: { estado: "pendiente" },
        orderBy: { fechaVcto: "asc" },
      },
    },
  });

  if (!cliente || cliente.cuotas.length === 0) {
    // Cliente no encontrado o sin deudas → responder mensaje genérico
    const config = await db.configEmpresa.findUnique({ where: { empresaId } });
    if (config) {
      const { enviarMensajeDatafy } = await import("@/lib/datafy");
      await enviarMensajeDatafy(
        config,
        telefono,
        "Hola! Bienvenido a VIZA HOME E.A.S. Te contactamos desde el Departamento de Cobranzas. Si tenes consultas sobre tu cuenta, comunicate al 021 123 456. Gracias."
      );
    }
    return;
  }

  // Generar mensaje de cobranza con el motor de templates
  const { generarMensajeAgrupado } = await import("@/lib/mensajes");
  const mensaje = await generarMensajeAgrupado(empresaId, cliente, cliente.cuotas);

  // Enviar el mensaje al cliente
  const config = await db.configEmpresa.findUnique({ where: { empresaId } });
  if (config) {
    const { enviarMensajeDatafy } = await import("@/lib/datafy");
    const result = await enviarMensajeDatafy(config, telefono, mensaje);

    if (result.success) {
      // Guardar el mensaje saliente en la conversación
      await db.mensaje.create({
        data: {
          conversacionId,
          waId: result.messageId,
          tipo: "text",
          contenido: mensaje,
          esEntrante: false,
          estado: "enviado",
        },
      });

      // Marcar cuotas como notificadas
      const cuotaIds = cliente.cuotas.map((q: any) => q.id);
      await db.cuota.updateMany({
        where: { id: { in: cuotaIds } },
        data: { notificado: true, ultimaNotificacion: new Date() },
      });

      // Registrar notificación
      await db.notificacion.create({
        data: {
          empresaId,
          clienteId: cliente.id,
          telefono,
          mensaje,
          tipo: "individual",
          estado: "enviada",
        },
      });

      // Registrar contacto del día (automático) — solo si hay un usuario sistema válido
      try {
        // Buscar un usuario admin/cobrador del sistema para asociar el contacto
        const usuarioSistema = await db.usuario.findFirst({
          where: { empresaId, login: "admin" },
          select: { id: true },
        });
        if (usuarioSistema) {
          await db.contactoDia.create({
            data: {
              empresaId,
              usuarioId: usuarioSistema.id,
              clienteId: cliente.id,
              telefono,
              tipo: "whatsapp",
              notas: "Auto-respuesta del sistema (cliente escribió Hola)",
            },
          });
        }
      } catch (e) {
        console.error("[webhook] No se pudo registrar ContactoDia:", e);
      }

      console.log("[webhook] Auto-respuesta enviada a:", telefono);
    }
  }
}

// Procesa ecos de mensajes enviados desde la app del teléfono (smb_message_echoes / smb_app_state_sync)
async function procesarEcoMensaje(empresaId: string, msg: any, value: any) {
  const telefonoTo = msg.to || value.contacts?.[0]?.wa_id;
  if (!telefonoTo) return;

  // Normalizar teléfono
  let telefono = telefonoTo;
  if (telefono.startsWith("595")) telefono = "0" + telefono.slice(3);

  // Buscar conversación
  let conv = await db.conversacion.findFirst({
    where: { telefono, empresaId },
  });

  if (!conv) {
    const cliente = await db.cliente.findFirst({
      where: { telefono, empresaId },
    });
    conv = await db.conversacion.create({
      data: {
        empresaId,
        telefono,
        clienteId: cliente?.id || null,
        nombreWa: value.contacts?.[0]?.profile?.name || null,
        estado: "activa",
        ultimoMensaje: new Date(),
        noLeidos: 0,
      },
    });
  } else {
    conv = await db.conversacion.update({
      where: { id: conv.id },
      data: { ultimoMensaje: new Date(), estado: "activa" },
    });
  }

  // Extraer contenido
  let contenido = "";
  let tipo = "text";
  if (msg.type === "text") {
    contenido = msg.text?.body || "";
  } else if (msg.type === "audio") {
    tipo = "audio";
    contenido = "[Audio enviado desde el teléfono]";
  } else if (msg.type === "image") {
    tipo = "image";
    contenido = "[Imagen enviada desde el teléfono]";
  } else {
    contenido = `[${msg.type} enviado desde el teléfono]`;
  }

  // Guardar como mensaje saliente
  await db.mensaje.create({
    data: {
      conversacionId: conv.id,
      waId: msg.id,
      tipo,
      contenido,
      esEntrante: false,
      estado: "enviado",
    },
  });

  console.log("[webhook] Eco de mensaje guardado:", telefono, tipo);
}

async function procesarStatusUpdate(empresaId: string, status: any) {
  const messageId = status.id;
  const statusValue = status.status; // sent | delivered | read | failed

  // Mapear a nuestro estado
  const estadoMap: Record<string, string> = {
    sent: "enviado",
    delivered: "entregado",
    read: "leido",
    failed: "fallido",
  };
  const estado = estadoMap[statusValue] || statusValue;

  // Actualizar mensaje por waId
  if (messageId) {
    await db.mensaje.updateMany({
      where: { waId: messageId },
      data: { estado },
    });
  }

  // Si falló, registrar en log
  if (statusValue === "failed") {
    await db.metaMensajeLog.updateMany({
      where: { mensajeId: messageId },
      data: { estado: "fallido", error: JSON.stringify(status.errors) },
    });
  } else {
    await db.metaMensajeLog.updateMany({
      where: { mensajeId: messageId },
      data: { estado },
    });
  }
}
