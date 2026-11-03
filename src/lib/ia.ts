/**
 * IA Helper — soporta múltiples proveedores:
 *
 * 1. NVIDIA NIM (default, gratis, OpenAI-compatible)
 *    - Endpoint: https://integrate.api.nvidia.com/v1/chat/completions
 *    - Modelos: meta/llama-3.2-11b-vision-instruct (default), nvidia/llama-3.1-nemotron-70b-instruct
 *
 * 2. Google Gemini (para transcripción de audios)
 *    - Endpoint: Vertex AI / Generative Language API
 *
 * 3. Ollama (local, opcional)
 *    - Endpoint: configurable (default http://localhost:11434)
 *
 * La transcripción de audios queda "en abierto" — por ahora usa Gemini,
 * pero está preparada para agregar Whisper u otros en el futuro.
 */
import { db } from "./db";
import type { ConfigEmpresa } from "@prisma/client";

// ============================================================
// CLIENTE NVIDIA NIM (OpenAI-compatible)
// ============================================================

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
}

/**
 * Llama al modelo de NVIDIA NIM (formato OpenAI-compatible).
 */
async function nvidiaChat(
  apiKey: string,
  modelo: string,
  messages: ChatMessage[],
  opts: ChatOptions = {}
): Promise<string> {
  const body: any = {
    model: modelo,
    messages,
    max_tokens: opts.maxTokens ?? 500,
    temperature: opts.temperature ?? 0.4,
  };

  const res = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`NVIDIA API error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

// ============================================================
// CLIENTE OLLAMA (local)
// ============================================================

async function ollamaChat(
  url: string,
  modelo: string,
  messages: ChatMessage[],
  opts: ChatOptions = {}
): Promise<string> {
  const res = await fetch(`${url.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelo,
      messages,
      stream: false,
      options: {
        temperature: opts.temperature ?? 0.4,
        num_predict: opts.maxTokens ?? 500,
      },
    }),
  });
  if (!res.ok) throw new Error(`Ollama error ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

// ============================================================
// FUNCIONES AUXILIARES
// ============================================================

/**
 * Obtiene la configuración de IA de la empresa.
 */
async function getConfig(empresaId: string): Promise<ConfigEmpresa> {
  let config = await db.configEmpresa.findUnique({ where: { empresaId } });
  if (!config) {
    config = await db.configEmpresa.create({ data: { empresaId } });
  }
  return config;
}

/**
 * Llama al LLM seleccionado en la configuración (nvidia, ollama, o gemini-text).
 * Para Gemini de texto usamos también el endpoint de chat.
 */
async function llamarLLM(
  config: ConfigEmpresa,
  messages: ChatMessage[],
  opts: ChatOptions = {}
): Promise<string> {
  const proveedor = config.iaProveedor || "nvidia";

  if (proveedor === "nvidia") {
    if (!config.nvidiaApiKey) throw new Error("NVIDIA API Key no configurada");
    const modelo = config.nvidiaModelo || "meta/llama-3.2-11b-vision-instruct";
    return nvidiaChat(config.nvidiaApiKey, modelo, messages, opts);
  }

  if (proveedor === "ollama") {
    if (!config.ollamaUrl) throw new Error("Ollama URL no configurada");
    const modelo = config.ollamaModelo || "llama3.2";
    return ollamaChat(config.ollamaUrl, modelo, messages, opts);
  }

  if (proveedor === "gemini") {
    if (!config.geminiApiKey) throw new Error("Gemini API Key no configurada");
    // Gemini vía OpenAI-compatible (Google AI Studio)
    return geminiChat(config.geminiApiKey, config.geminiModelo || "gemini-2.5-flash", messages, opts);
  }

  throw new Error(`Proveedor de IA no soportado: ${proveedor}`);
}

/**
 * Gemini vía endpoint OpenAI-compatible de Google AI Studio.
 */
async function geminiChat(
  apiKey: string,
  modelo: string,
  messages: ChatMessage[],
  opts: ChatOptions = {}
): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelo,
        messages,
        max_tokens: opts.maxTokens ?? 500,
        temperature: opts.temperature ?? 0.4,
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

/**
 * Intenta extraer JSON de una respuesta de LLM (maneja markdown code blocks).
 */
function parseJSONFromLLM(content: string): any {
  let s = content.trim();
  // Quitar code blocks markdown
  const match = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) s = match[1].trim();
  // Quitar texto antes/después del JSON
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  return JSON.parse(s);
}

// ============================================================
// RESUMEN DE CONVERSACIÓN + DETECCIÓN DE COMPROMISOS
// ============================================================

export interface ResumenResult {
  resumen: string;
  compromisoDetectado: boolean;
  fechaCompromiso?: Date;
  montoMencionado?: number;
  sentimiento: "positivo" | "neutral" | "negativo";
}

export async function generarResumenConversacion(
  empresaId: string,
  mensajes: { esEntrante: boolean; contenido: string; transcripcion?: string }[]
): Promise<ResumenResult> {
  const config = await getConfig(empresaId);
  if (!config.iaResumenesActiva) {
    return {
      resumen: "Resúmenes IA desactivados. Activa en Configuración > IA.",
      compromisoDetectado: false,
      sentimiento: "neutral",
    };
  }

  const conversacion = mensajes
    .map((m) => {
      const quien = m.esEntrante ? "Cliente" : "Cobrador";
      return `${quien}: ${m.transcripcion || m.contenido}`;
    })
    .join("\n");

  if (!conversacion.trim()) {
    return { resumen: "Sin mensajes para resumir.", compromisoDetectado: false, sentimiento: "neutral" };
  }

  const systemPrompt = `Eres un asistente experto en análisis de conversaciones de cobranza en Paraguay.
Analiza la conversación entre un cobrador y un cliente de WhatsApp.

Responde en formato JSON estricto con esta estructura:
{
  "resumen": "Resumen conciso de 2-3 líneas de qué se habló",
  "compromisoDetectado": true/false,
  "fechaCompromiso": "YYYY-MM-DD o null (si el cliente mencionó fecha de pago)",
  "montoMencionado": número o null (si mencionó monto a pagar),
  "sentimiento": "positivo" | "neutral" | "negativo"
}

REGLAS:
- compromisoDetectado = true SOLO si el cliente dijo explícitamente que va a pagar (ej: "mañana pago", "el viernes paso", "ya transferí")
- fechaCompromiso: parsear cualquier mención de fecha ("mañana", "el viernes", "el 15", "próxima semana")
- sentimiento: positivo = cooperativo, negativo = agresivo/evasivo, neutral = informativo
- NO incluyas markdown ni texto fuera del JSON
- Hoy es: ${new Date().toISOString().slice(0, 10)}`;

  try {
    const content = await llamarLLM(config, [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Conversación:\n\n${conversacion}` },
    ], { temperature: 0.2, maxTokens: 300 });

    const parsed = parseJSONFromLLM(content);

    return {
      resumen: parsed.resumen || "Sin resumen",
      compromisoDetectado: !!parsed.compromisoDetectado,
      fechaCompromiso: parsed.fechaCompromiso ? new Date(parsed.fechaCompromiso) : undefined,
      montoMencionado: parsed.montoMencionado || undefined,
      sentimiento: parsed.sentimiento || "neutral",
    };
  } catch (e: any) {
    console.error("[IA] Error generando resumen:", e);
    return {
      resumen: "Error al generar resumen: " + (e.message || "desconocido"),
      compromisoDetectado: false,
      sentimiento: "neutral",
    };
  }
}

// ============================================================
// DETECCIÓN RÁPIDA DE COMPROMISO (mensaje entrante único)
// ============================================================

export async function detectarCompromisoRapido(
  empresaId: string,
  mensaje: string
): Promise<{
  esCompromiso: boolean;
  fecha?: Date;
  monto?: number;
  confianza: number;
}> {
  const config = await getConfig(empresaId);
  if (!config.autoDetectarCompromisos) {
    return { esCompromiso: false, confianza: 0 };
  }

  const systemPrompt = `Detecta si el mensaje del cliente es un compromiso de pago.
Responde JSON estricto: {"esCompromiso": true/false, "fecha": "YYYY-MM-DD o null", "monto": número o null, "confianza": 0-1}

Ejemplos de compromiso:
- "Mañana pago" → esCompromiso: true, fecha: mañana
- "El viernes paso a pagar" → true
- "Ya transferí" → true (sin fecha futura)
- "No puedo pagar esta semana" → false (no es compromiso de pago, es negativa)
- "Gracias por el aviso" → false

Hoy es: ${new Date().toISOString().slice(0, 10)}`;

  try {
    const content = await llamarLLM(config, [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Mensaje: "${mensaje}"` },
    ], { temperature: 0.1, maxTokens: 100 });

    const parsed = parseJSONFromLLM(content);
    return {
      esCompromiso: !!parsed.esCompromiso,
      fecha: parsed.fecha ? new Date(parsed.fecha) : undefined,
      monto: parsed.monto || undefined,
      confianza: parsed.confianza || 0,
    };
  } catch (e: any) {
    console.error("[IA] Error detectando compromiso:", e);
    return { esCompromiso: false, confianza: 0 };
  }
}

// ============================================================
// GENERACIÓN DE MENSAJE DE COBRANZA PERSONALIZADO
// ============================================================

export async function generarMensajeCobranza(
  empresaId: string,
  opts: {
    nombreCliente: string;
    monto: number;
    diasAtraso: number;
    fechaVcto: string;
    historialReciente?: string;
  }
): Promise<string> {
  const config = await getConfig(empresaId);

  const systemPrompt = `Eres un cobrador profesional paraguayo. Genera un mensaje de WhatsApp corto y efectivo para recordar pago de cuota.
REGLAS:
- Tono cordial pero firme
- Máximo 3 líneas
- Mencionar monto en Guaraníes (₲)
- Si diasAtraso > 0, mencionar días de atraso
- Si diasAtraso > 30, mencionar riesgo Informconf
- NO incluir emojis
- Terminar con "Comuníquese al 021 123 456."`;

  const userMsg = `Genera mensaje para:
- Cliente: ${opts.nombreCliente}
- Monto: ₲ ${new Intl.NumberFormat("es-PY").format(opts.monto)}
- Días de atraso: ${opts.diasAtraso}
- Vencimiento: ${opts.fechaVcto}
${opts.historialReciente ? `- Historial reciente: ${opts.historialReciente}` : ""}`;

  try {
    const content = await llamarLLM(config, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMsg },
    ], { temperature: 0.6, maxTokens: 200 });
    return content.trim();
  } catch (e: any) {
    console.error("[IA] Error generando mensaje:", e);
    return "";
  }
}

// ============================================================
// TRANSCRIPCIÓN DE AUDIOS
// ============================================================
// Esta función queda "en abierto" — por ahora usa Gemini,
// pero está preparada para agregar otros proveedores en el futuro
// (Whisper, NVIDIA ASR, Azure Speech, etc.)

export async function transcribirAudio(
  empresaId: string,
  audioBase64: string,
  mimeType = "audio/ogg"
): Promise<{ texto: string; error?: string; proveedor?: string }> {
  const config = await getConfig(empresaId);
  const proveedor = config.transcripcionProveedor || "gemini";

  // === GEMINI (default actual) ===
  if (proveedor === "gemini") {
    if (!config.geminiApiKey) {
      return { texto: "", error: "Gemini API Key no configurada para transcripción", proveedor: "gemini" };
    }
    try {
      const modelo = config.geminiModelo || "gemini-2.5-flash";
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${config.geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: "Transcribe este audio en español. Devuelve solo el texto transcrito, sin comentarios." },
                { inline_data: { mime_type: mimeType, data: audioBase64 } },
              ],
            }],
          }),
        }
      );
      if (!res.ok) {
        return { texto: "", error: `Gemini error ${res.status}`, proveedor: "gemini" };
      }
      const data = await res.json();
      const texto = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return { texto: texto.trim(), proveedor: "gemini" };
    } catch (e: any) {
      return { texto: "", error: e.message, proveedor: "gemini" };
    }
  }

  // === FUTURO: otros proveedores de transcripción ===
  // if (proveedor === "whisper") { ... }
  // if (proveedor === "nvidia-asr") { ... }
  // if (proveedor === "azure-speech") { ... }

  return { texto: "", error: `Proveedor de transcripción no soportado: ${proveedor}` };
}

// ============================================================
// LISTAR MODELOS NVIDIA DISPONIBLES
// ============================================================

export async function listarModelosNvidia(apiKey: string): Promise<string[]> {
  const res = await fetch(`${NVIDIA_BASE_URL}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  const data = await res.json();
  return (data.data || [])
    .map((m: any) => m.id)
    .filter((id: string) => /instruct|chat|it$/i.test(id))
    .sort();
}

// ============================================================
// PROBAR CONEXIÓN
// ============================================================

export async function probarConexion(empresaId: string): Promise<{
  ok: boolean;
  proveedor: string;
  modelo: string;
  mensaje: string;
}> {
  try {
    const config = await getConfig(empresaId);
    const proveedor = config.iaProveedor || "nvidia";
    const modelo = proveedor === "nvidia"
      ? (config.nvidiaModelo || "meta/llama-3.2-11b-vision-instruct")
      : proveedor === "ollama"
        ? (config.ollamaModelo || "llama3.2")
        : (config.geminiModelo || "gemini-2.5-flash");

    const content = await llamarLLM(config, [
      { role: "user", content: "Responde solo: OK" },
    ], { maxTokens: 10, temperature: 0 });

    return {
      ok: true,
      proveedor,
      modelo,
      mensaje: `Conexión exitosa. Respuesta: "${content.slice(0, 50)}"`,
    };
  } catch (e: any) {
    return {
      ok: false,
      proveedor: "desconocido",
      modelo: "desconocido",
      mensaje: e.message || "Error desconocido",
    };
  }
}
