import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";
import { listarModelosNvidia } from "@/lib/ia";

/**
 * GET /api/ia/modelos
 * Lista modelos disponibles en NVIDIA NIM.
 */
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  let apiKey = searchParams.get("apiKey");

  if (!apiKey) {
    const config = await db.configEmpresa.findUnique({ where: { empresaId: user.empresaId } });
    apiKey = config?.nvidiaApiKey || undefined;
  }

  if (!apiKey) return fail("NVIDIA API Key no configurada");

  try {
    const modelos = await listarModelosNvidia(apiKey);
    return ok({ modelos, total: modelos.length });
  } catch (e: any) {
    return fail(e.message || "Error al listar modelos", 500);
  }
}
