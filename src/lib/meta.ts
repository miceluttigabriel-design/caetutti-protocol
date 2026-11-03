/**
 * Meta Cloud API (WhatsApp Business Platform) — Helper oficial
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 * Endpoint: https://graph.facebook.com/v21.0/{phone_number_id}/messages
 *
 * Costos por país (USD por conversación iniciada por negocio):
 * - Paraguay: UTILITY $0.0225, MARKETING $0.0775, SERVICE $0.0088, AUTH $0.0141
 * - Primeras 1000 conversaciones de servicio por mes: GRATIS
 *
 * Tier límites (business-initiated conversations / 24h):
 * - Tier 1: 250  →  Tier 2: 1,000  →  Tier 3: 10,000  →  Tier 4: 100,000
 * - Sube automáticamente tras 7 días con calidad alta
 */

import { db } from "./db";
import type { ConfigEmpresa } from "@prisma/client";
import { enviarMensajeDatafy, enviarTemplateDatafy } from "./datafy";

const META_API_VERSION = "v21.0";
const META_GRAPH_URL = `https://graph.facebook.com/${META_API_VERSION}`;

// Costos por categoría en USD (Paraguay, actualizado 2025)
export const META_COSTOS_PARAGUAY = {
  UTILITY: 0.0225,
  MARKETING: 0.0775,
  SERVICE: 0.0088,
  AUTHENTICATION: 0.0141,
} as const;

export type MetaCategoria = keyof typeof META_COSTOS_PARAGUAY;

export interface MetaSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  costoEstimado?: number;
  categoria?: MetaCategoria;
}

/**
 * Normaliza un teléfono al formato internacional requerido por Meta.
 * - "0981123456" → "595981123456"
 * - "+595981123456" → "595981123456"
 * - "595981123456" → "595981123456"
 */
export function normalizarTelefonoPY(phone: string): string | null {
  if (!phone) return null;
  let clean = phone.replace(/\D/g, "");
  // Caso: 09XX XXX XXX → 595 9XX XXX XXX
  if (clean.length === 10 && clean.startsWith("09")) {
    return "595" + clean.slice(1);
  }
  // Caso: 9XX XXX XXX sin 0 (raro)
  if (clean.length === 9 && clean.startsWith("9")) {
    return "595" + clean;
  }
  // Ya está en formato internacional
  if (clean.length === 12 && clean.startsWith("595")) {
    return clean;
  }
  if (clean.length === 13 && clean.startsWith("595")) {
    return clean;
  }
  // Caso: 595 + 9 dígitos (algunos números paraguayos)
  if (clean.length === 11 && clean.startsWith("595")) {
    return clean;
  }
  // Fallback: si no matchea ningún patrón pero tiene al menos 6 dígitos,
  // devolver el número limpio (sin descartarlo)
  if (clean.length >= 6) {
    return clean;
  }
  return null;
}

/**
 * Envía un mensaje de texto simple (sin template).
 * Solo funciona si el cliente escribió primero en las últimas 24h (ventana de servicio).
 *
 * Para mensajes fuera de ventana, usar enviarTemplate().
 */
export async function enviarMensajeTexto(
  config: ConfigEmpresa,
  telefono: string,
  mensaje: string
): Promise<MetaSendResult> {
  // Check límite mensual (aplica para ambos proveedores)
  const limiteCheck = await checkLimiteMensual(config.empresaId);
  if (!limiteCheck.puedeEnviar) {
    return {
      success: false,
      error: `Límite mensual alcanzado ($${limiteCheck.costoActual.toFixed(2)} / $${limiteCheck.limite.toFixed(2)}). ${
        limiteCheck.bloqueado ? "Envíos bloqueados." : ""
      }`,
    };
  }

  // === Enrutar según proveedor ===
  if (config.whatsappProveedor === "datafy") {
    const r = await enviarMensajeDatafy(config, telefono, mensaje);
    const categoria: MetaCategoria = "SERVICE";
    const costo = META_COSTOS_PARAGUAY[categoria];

    if (r.success) {
      // Loguear envío exitoso
      await logMensaje(config.empresaId, telefono, r.messageId, categoria, "enviado", costo);
      await incrementarUsoMensual(config.empresaId, categoria, costo);
      return { success: true, messageId: r.messageId, categoria, costoEstimado: costo };
    }
    // Loguear fallo
    await logMensaje(config.empresaId, telefono, undefined, categoria, "fallido", 0, r.error);
    return { success: false, error: r.error };
  }

  // === Meta Cloud API directo ===
  if (!config.metaPhoneNumberId || !config.metaAccessToken) {
    return { success: false, error: "Meta no configurado" };
  }
  const phoneNorm = normalizarTelefonoPY(telefono);
  if (!phoneNorm) {
    return { success: false, error: `Teléfono inválido: ${telefono}` };
  }

  try {
    const url = `${META_GRAPH_URL}/${config.metaPhoneNumberId}/messages`;
    const body = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phoneNorm,
      type: "text",
      text: { body: mensaje, preview_url: false },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.metaAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      await logMensaje(config.empresaId, telefono, undefined, "SERVICE", "fallido", 0, JSON.stringify(data.error));
      return { success: false, error: JSON.stringify(data.error) };
    }

    const messageId = data.messages?.[0]?.id;
    const categoria: MetaCategoria = "SERVICE";
    const costo = META_COSTOS_PARAGUAY[categoria];

    await logMensaje(config.empresaId, telefono, messageId, categoria, "enviado", costo);
    await incrementarUsoMensual(config.empresaId, categoria, costo);

    return { success: true, messageId, categoria, costoEstimado: costo };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Envía un mensaje usando una plantilla (template) aprobada por Meta.
 * Esto es lo que se usa para COBRANZA: mensaje de utilidad (UTILITY).
 *
 * Ejemplo:
 *   enviarTemplate(config, telefono, "recordatorio_vencimiento", "es", [
 *     ["type": "text", "text": "Juan Pérez"],
 *     ["type": "text", "text": "₲ 450.000"],
 *   ])
 */
export async function enviarTemplate(
  config: ConfigEmpresa,
  telefono: string,
  templateNombre: string,
  idioma: string,
  componentes: any[]
): Promise<MetaSendResult> {
  // Check límite mensual
  const limiteCheck = await checkLimiteMensual(config.empresaId);
  if (!limiteCheck.puedeEnviar) {
    return {
      success: false,
      error: `Límite mensual alcanzado ($${limiteCheck.costoActual.toFixed(2)} / $${limiteCheck.limite.toFixed(2)})`,
    };
  }

  // === Enrutar según proveedor ===
  if (config.whatsappProveedor === "datafy") {
    const r = await enviarTemplateDatafy(config, telefono, templateNombre, idioma, componentes);
    const categoria: MetaCategoria = "UTILITY";
    const costo = META_COSTOS_PARAGUAY[categoria];

    if (r.success) {
      await logMensaje(config.empresaId, telefono, r.messageId, categoria, "enviado", costo);
      await incrementarUsoMensual(config.empresaId, categoria, costo);
      return { success: true, messageId: r.messageId, categoria, costoEstimado: costo };
    }
    await logMensaje(config.empresaId, telefono, undefined, categoria, "fallido", 0, r.error);
    return { success: false, error: r.error };
  }

  // === Meta Cloud API directo ===
  if (!config.metaPhoneNumberId || !config.metaAccessToken) {
    return { success: false, error: "Meta no configurado" };
  }
  const phoneNorm = normalizarTelefonoPY(telefono);
  if (!phoneNorm) {
    return { success: false, error: `Teléfono inválido: ${telefono}` };
  }

  try {
    const url = `${META_GRAPH_URL}/${config.metaPhoneNumberId}/messages`;
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
        Authorization: `Bearer ${config.metaAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      await logMensaje(config.empresaId, telefono, undefined, "UTILITY", "fallido", 0, JSON.stringify(data.error));
      return { success: false, error: JSON.stringify(data.error) };
    }

    const messageId = data.messages?.[0]?.id;
    const categoria: MetaCategoria = "UTILITY";
    const costo = META_COSTOS_PARAGUAY[categoria];

    await logMensaje(config.empresaId, telefono, messageId, categoria, "enviado", costo);
    await incrementarUsoMensual(config.empresaId, categoria, costo);

    return { success: true, messageId, categoria, costoEstimado: costo };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Verifica el estado de conexión del número con Meta.
 */
export async function verificarConexionMeta(config: ConfigEmpresa): Promise<{
  conectado: boolean;
  phoneNumber?: string;
  status?: string;
  error?: string;
}> {
  if (!config.metaPhoneNumberId || !config.metaAccessToken) {
    return { conectado: false, error: "Configuración incompleta" };
  }
  try {
    const url = `${META_GRAPH_URL}/${config.metaPhoneNumberId}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${config.metaAccessToken}` },
    });
    const data = await res.json();
    if (!res.ok) return { conectado: false, error: JSON.stringify(data.error) };

    return {
      conectado: data.verified_name ? true : false,
      phoneNumber: data.display_phone_number,
      status: data.quality_rating || "ok",
    };
  } catch (e: any) {
    return { conectado: false, error: e.message };
  }
}

// =============================================================
// CONTROL DE USO MENSUAL Y LÍMITES DE COSTO
// =============================================================

export async function getMesActual(): Promise<string> {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function getOrCreateUsoMensual(empresaId: string, anhoMes?: string) {
  const mes = anhoMes || (await getMesActual());
  let uso = await db.metaUsoMensual.findUnique({
    where: { empresaId_anhoMes: { empresaId, anhoMes: mes } },
  });
  if (!uso) {
    uso = await db.metaUsoMensual.create({
      data: { empresaId, anhoMes: mes },
    });
  }
  return uso;
}

export async function checkLimiteMensual(empresaId: string): Promise<{
  puedeEnviar: boolean;
  costoActual: number;
  limite: number;
  bloqueado: boolean;
  porcentaje: number;
}> {
  const config = await db.configEmpresa.findUnique({ where: { empresaId } });
  if (!config) {
    return { puedeEnviar: false, costoActual: 0, limite: 0, bloqueado: true, porcentaje: 0 };
  }
  const uso = await getOrCreateUsoMensual(empresaId);

  // Recalcular costo actual desde logs del mes
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  const agg = await db.metaMensajeLog.aggregate({
    where: { empresaId, createdAt: { gte: inicioMes }, estado: { not: "fallido" } },
    _sum: { costoUsd: true },
  });
  const costoActual = agg._sum.costoUsd || 0;

  const limite = config.metaLimiteMensualUsd;
  const porcentaje = limite > 0 ? (costoActual / limite) * 100 : 0;
  const bloqueado =
    config.metaBloquearAlLimite && costoActual >= limite;

  return {
    puedeEnviar: !bloqueado,
    costoActual,
    limite,
    bloqueado,
    porcentaje,
  };
}

async function incrementarUsoMensual(
  empresaId: string,
  categoria: MetaCategoria,
  costo: number
) {
  const mes = await getMesActual();
  const uso = await getOrCreateUsoMensual(empresaId, mes);
  const updates: any = { costoEstimadoUsd: { increment: costo } };
  if (categoria === "UTILITY") updates.enviadosUtility = { increment: 1 };
  if (categoria === "MARKETING") updates.enviadosMarketing = { increment: 1 };
  if (categoria === "SERVICE") updates.enviadosService = { increment: 1 };
  if (categoria === "AUTHENTICATION") updates.enviadosAuth = { increment: 1 };

  // Verificar si debe bloquearse
  const config = await db.configEmpresa.findUnique({ where: { empresaId } });
  const nuevoCosto = uso.costoEstimadoUsd + costo;
  if (config?.metaBloquearAlLimite && nuevoCosto >= config.metaLimiteMensualUsd) {
    updates.bloqueado = true;
  }

  await db.metaUsoMensual.update({
    where: { id: uso.id },
    data: updates,
  });
}

async function logMensaje(
  empresaId: string,
  telefono: string,
  mensajeId: string | undefined,
  categoria: MetaCategoria,
  estado: string,
  costo: number,
  error?: string
) {
  await db.metaMensajeLog.create({
    data: {
      empresaId,
      telefono,
      mensajeId,
      categoria,
      estado,
      costoUsd: costo,
      error,
    },
  });
}

/**
 * Sustituye variables {Entidad}, {Saldo en Gs}... en un mensaje.
 * Compatible con el sistema de plantillas del CobranzasFlow.
 */
export function sustituirVariables(mensaje: string, vars: Record<string, string | number>): string {
  let result = mensaje;
  for (const [k, v] of Object.entries(vars)) {
    result = result.replaceAll(`{${k}}`, String(v));
  }
  return result;
}

/**
 * Convierte un mensaje con variables {Entidad}... al formato de template Meta {{1}}, {{2}}...
 * y devuelve el array de componentes listo para enviarTemplate().
 */
export function construirComponentesTemplate(
  mensajeTemplate: string,
  vars: Record<string, string | number>
): { params: { type: "text"; text: string }[]; componentes: any[] } {
  // Buscar variables {Entidad}, {Saldo en Gs}, etc.
  const regex = /\{([^}]+)\}/g;
  const found: string[] = [];
  let match;
  while ((match = regex.exec(mensajeTemplate)) !== null) {
    found.push(match[1]);
  }

  // Construir params en orden
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
