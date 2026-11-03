import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";
import { verificarConexionMeta } from "@/lib/meta";
import { verificarConexionDatafy } from "@/lib/datafy";

/**
 * GET /api/whatsapp/status
 * Verifica la conexión con el proveedor WhatsApp configurado (Meta o Datafy).
 */
export async function GET() {
  const user = await getSession();
  if (!user) return unauthorized();

  const config = await db.configEmpresa.findUnique({
    where: { empresaId: user.empresaId },
  });
  if (!config) return fail("Configuración no encontrada", 500);

  // === Enrutar según proveedor ===
  if (config.whatsappProveedor === "datafy") {
    const conexion = await verificarConexionDatafy(config);
    await db.configEmpresa.update({
      where: { id: config.id },
      data: { datafyStatus: conexion.conectado ? "connected" : "disconnected" },
    });
    return ok(conexion);
  }

  // === Meta Cloud API ===
  const conexion = await verificarConexionMeta(config);
  await db.configEmpresa.update({
    where: { id: config.id },
    data: { metaStatus: conexion.conectado ? "connected" : "disconnected" },
  });
  return ok(conexion);
}
