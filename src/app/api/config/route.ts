import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";

// GET /api/config — returns config + whatsapp instance + stats
export async function GET() {
  const user = await getSession();
  if (!user) return unauthorized();

  let config = await db.configEmpresa.findUnique({
    where: { empresaId: user.empresaId },
  });

  if (!config) {
    config = await db.configEmpresa.create({
      data: { empresaId: user.empresaId },
    });
  }

  const stats = await db.usuario.aggregate({
    where: { empresaId: user.empresaId },
    _count: true,
  });

  return ok({
    config,
    whatsapp: { status: config.metaStatus, instanceName: config.metaPhoneNumber || "" },
    totalUsuarios: stats._count,
  });
}

// PUT /api/config — update config fields
export async function PUT(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const body = await req.json();
  const allowed = [
    "defaultPassword", "cooldownClientes", "cooldownCodeudores",
    // Proveedor WhatsApp
    "whatsappProveedor", // meta | datafy
    // Meta Cloud API
    "metaPhoneNumberId", "metaWabaId", "metaAccessToken", "metaVerifyToken",
    "metaBusinessId", "metaWebhookSecret", "metaPhoneNumber",
    // Datafy (partner Meta)
    "datafyApiKey", "datafyChannelId", "datafyChannelName",
    "datafyPhoneNumber", "datafyBaseUrl",
    // Límites de costo
    "metaLimiteMensualUsd", "metaAlertaPorcentaje", "metaBloquearAlLimite",
    // IA - Proveedor principal
    "iaProveedor", // nvidia | gemini | ollama | ninguno
    // NVIDIA NIM (OpenAI-compatible, gratis)
    "nvidiaApiKey", "nvidiaModelo",
    // Google Gemini (texto + transcripción)
    "geminiApiKey", "geminiModelo",
    // Ollama (local)
    "ollamaUrl", "ollamaModelo",
    // Transcripción (abierto para futuro)
    "transcripcionProveedor", // gemini | ninguno (futuro: whisper, nvidia-asr)
    "iaResumenesActiva", "iaTranscripcionActiva",
    // Automatización
    "autoNotificar", "autoDetectarCompromisos",
  ];

  const data: any = {};
  for (const k of allowed) {
    if (k in body) {
      data[k] = typeof body[k] === "boolean"
        ? body[k]
        : typeof body[k] === "number"
          ? Number(body[k])
          : body[k];
    }
  }

  const config = await db.configEmpresa.upsert({
    where: { empresaId: user.empresaId },
    update: data,
    create: { empresaId: user.empresaId, ...data },
  });

  return ok({ config });
}
