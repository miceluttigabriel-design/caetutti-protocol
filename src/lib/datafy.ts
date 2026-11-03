/**
 * Datafy Helper — Integración con Datafy (partner oficial Meta WhatsApp).
 *
 * 🔗 https://datafy.com.br
 *
 * Datafy es un BSP (Business Solution Provider) oficial de Meta.
 * Su API es un wrapper sobre la WhatsApp Cloud API de Meta, pero más simple:
 * - No necesitás configurar Meta App Dashboard
 * - El QR/conexión se hace desde el dashboard de Datafy
 * - El webhook es unificado (Datafy lo gestiona)
 *
 * 📝 DOCUMENTACIÓN:
 * La documentación oficial está dentro del dashboard (tras login):
 *   Datafy → Documentação
 *
 * Endpoints típicos de partners BSP (patrón similar a 360dialog, Wati, etc.):
 * - POST {baseUrl}/messages           → enviar mensaje
 * - POST {baseUrl}/templates          → crear plantilla
 * - GET  {baseUrl}/templates          → listar plantillas
 * - GET  {url-publica}/webhook/datafy → recibir mensajes (configurable en dashboard)
 *
 * Headers:
 *   Authorization: Bearer {datafyApiKey}
 *   Content-Type: application/json
 *
 * ⚠️ ESTE HELPER ESTÁ PRE-CONFIGURADO PERO NO ACTIVO.
 * Cuando el usuario consiga su API Key y libere su cuenta, se activa.
 */

import { db } from "./db";
import type { ConfigEmpresa } from "@prisma/client";

// ============================================================
// ENVIAR MENSAJE DE TEXTO
// ============================================================

export interface DatafySendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Envía un mensaje de texto vía Datafy.
 *
 * Body típico de partners BSP:
 * {
 *   "messaging_product": "whatsapp",
 *   "to": "595981123456",
 *   "type": "text",
 *   "text": { "body": "Hola..." }
 * }
 */
export async function enviarMensajeDatafy(
  config: ConfigEmpresa,
  telefono: string,
  mensaje: string
): Promise<DatafySendResult> {
  if (!config.datafyApiKey) {
    return { success: false, error: "Datafy API Key no configurada" };
  }
  // Datafy usa el Phone Number ID de Meta en la URL (igual que Meta Cloud API)
  const phoneNumberId = config.metaPhoneNumberId;
  if (!phoneNumberId) {
    return { success: false, error: "Phone Number ID no configurado" };
  }

  const phoneNorm = normalizarTelefonoPY(telefono);
  if (!phoneNorm) {
    return { success: false, error: `Teléfono inválido: ${telefono}` };
  }

  const baseUrl = (config.datafyBaseUrl || "https://cloud.datafyapi.com.br/v1").replace(/\/$/, "");
  const url = `${baseUrl}/${phoneNumberId}/messages`;

  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phoneNorm,
    type: "text",
    text: { body: mensaje, preview_url: false },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.datafyApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      const errMsg = data.error?.message || data.message || JSON.stringify(data.error || data);
      return { success: false, error: errMsg };
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ============================================================
// ENVIAR MENSAJE CON PLANTILLA (template)
// ============================================================

export async function enviarTemplateDatafy(
  config: ConfigEmpresa,
  telefono: string,
  templateNombre: string,
  idioma: string,
  componentes: any[]
): Promise<DatafySendResult> {
  if (!config.datafyApiKey) {
    return { success: false, error: "Datafy API Key no configurada" };
  }
  const phoneNumberId = config.metaPhoneNumberId;
  if (!phoneNumberId) {
    return { success: false, error: "Phone Number ID no configurado" };
  }

  const phoneNorm = normalizarTelefonoPY(telefono);
  if (!phoneNorm) {
    return { success: false, error: `Teléfono inválido: ${telefono}` };
  }

  const baseUrl = (config.datafyBaseUrl || "https://cloud.datafyapi.com.br/v1").replace(/\/$/, "");

  try {
    const url = `${baseUrl}/${phoneNumberId}/messages`;
    const body = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phoneNorm,
      type: "template",
      template: {
        name: templateNombre,
        language: { code: idioma },
        components: componentes,
      },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.datafyApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      const errMsg = data.error?.message || data.message || JSON.stringify(data.error || data);
      return { success: false, error: errMsg };
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id || data.id,
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ============================================================
// VERIFICAR CONEXIÓN
// ============================================================

export async function verificarConexionDatafy(
  config: ConfigEmpresa
): Promise<{
  conectado: boolean;
  channelId?: string;
  channelName?: string;
  phoneNumber?: string;
  status?: string;
  error?: string;
}> {
  if (!config.datafyApiKey) {
    return { conectado: false, error: "Datafy API Key no configurada" };
  }
  const phoneNumberId = config.metaPhoneNumberId;
  if (!phoneNumberId) {
    return { conectado: false, error: "Phone Number ID no configurado" };
  }

  const baseUrl = (config.datafyBaseUrl || "https://cloud.datafyapi.com.br/v1").replace(/\/$/, "");

  try {
    // Verificar consultando info del Phone Number ID
    const url = `${baseUrl}/${phoneNumberId}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${config.datafyApiKey}` },
    });

    if (!res.ok) {
      return { conectado: false, error: `HTTP ${res.status}` };
    }

    const data = await res.json();
    return {
      conectado: true,
      channelId: config.datafyChannelId,
      channelName: data.verified_name || config.datafyChannelName,
      phoneNumber: data.display_phone_number || config.datafyPhoneNumber,
      status: data.quality_rating || "connected",
    };
  } catch (e: any) {
    return { conectado: false, error: e.message };
  }
}

// ============================================================
// WEBHOOK (recibir mensajes de Datafy)
// ============================================================

/**
 * Procesa el payload del webhook de Datafy.
 * El formato suele ser similar al de Meta Cloud API:
 * {
 *   "event": "message.received",
 *   "data": {
 *     "from": "595981123456",
 *     "to": "...",
 *     "message": { "type": "text", "text": "..." },
 *     "timestamp": "..."
 *   }
 * }
 *
 * Otros BSPs usan formato WhatsApp Cloud API nativo:
 * {
 *   "object": "whatsapp_business_account",
 *   "entry": [...]
 * }
 *
 * Esta función maneja ambos formatos.
 */
export function procesarWebhookDatafy(payload: any): {
  telefonoFrom?: string;
  mensajeTexto?: string;
  tipoMensaje?: string;
  mediaId?: string;
  messageId?: string;
  timestamp?: string;
} | null {
  // Formato 1: evento + data (algunos BSPs)
  if (payload.event && payload.data) {
    const d = payload.data;
    const from = d.from || d.contact?.phone || d.phone;
    const msg = d.message || d.messages?.[0];
    if (!from || !msg) return null;

    let texto = "";
    let tipo = "text";
    let mediaId: string | undefined;

    if (msg.type === "text") {
      texto = msg.text?.body || msg.text || "";
    } else if (msg.type === "audio") {
      tipo = "audio";
      mediaId = msg.audio?.id;
    } else if (msg.type === "image") {
      tipo = "image";
      mediaId = msg.image?.id;
    } else if (msg.type === "document") {
      tipo = "document";
      mediaId = msg.document?.id;
    } else {
      tipo = msg.type || "unknown";
    }

    return {
      telefonoFrom: from,
      mensajeTexto: texto,
      tipoMensaje: tipo,
      mediaId,
      messageId: msg.id,
      timestamp: d.timestamp,
    };
  }

  // Formato 2: WhatsApp Cloud API nativo (object + entry)
  if (payload.object === "whatsapp_business_account" && payload.entry) {
    for (const entry of payload.entry) {
      for (const change of entry.changes || []) {
        const value = change.value;
        if (value?.messages?.length) {
          const msg = value.messages[0];
          const from = msg.from;
          let texto = "";
          let tipo = "text";
          let mediaId: string | undefined;

          if (msg.type === "text") {
            texto = msg.text?.body || "";
          } else if (msg.type === "audio") {
            tipo = "audio";
            mediaId = msg.audio?.id;
          } else if (msg.type === "image") {
            tipo = "image";
            mediaId = msg.image?.id;
          } else {
            tipo = msg.type || "unknown";
          }

          return {
            telefonoFrom: from,
            mensajeTexto: texto,
            tipoMensaje: tipo,
            mediaId,
            messageId: msg.id,
            timestamp: msg.timestamp,
          };
        }
      }
    }
  }

  return null;
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Normaliza teléfono paraguayo a formato internacional.
 * 0981123456 → 595981123456
 */
export function normalizarTelefonoPY(phone: string): string | null {
  if (!phone) return null;
  let clean = phone.replace(/\D/g, "");
  if (clean.length === 0) return null;

  if (clean.startsWith("55") && clean.length >= 12) return clean;
  if (clean.startsWith("595") && clean.length >= 12) return "595" + clean.slice(3);
  if (clean.length === 10 && clean.startsWith("09")) return "595" + clean.slice(1);
  if (clean.length === 9 && clean.startsWith("9")) return "595" + clean;
  if (clean.length === 8 && clean.startsWith("4")) return "595" + clean;
  if (clean.length === 9 && clean.startsWith("0")) return "595" + clean.slice(1);

  return clean;
}

// ============================================================
// CONSTRUIR COMPONENTES DE TEMPLATE (igual que Meta)
// ============================================================

export function construirComponentesTemplate(
  mensajeTemplate: string,
  vars: Record<string, string | number>
): { params: { type: "text"; text: string }[]; componentes: any[] } {
  const regex = /\{([^}]+)\}/g;
  const found: string[] = [];
  let match;
  while ((match = regex.exec(mensajeTemplate)) !== null) {
    found.push(match[1]);
  }

  const params = found.map((varName) => ({
    type: "text" as const,
    text: String(vars[varName] ?? `{${varName}}`),
  }));

  return {
    params,
    componentes: [
      {
        type: "body",
        parameters: params,
      },
    ],
  };
}
