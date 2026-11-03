import { NextRequest } from "next/server";
import { getSession, ok, fail, unauthorized } from "@/lib/session";
import { probarConexion } from "@/lib/ia";

/**
 * POST /api/ia/probar
 * Prueba la conexión con el proveedor de IA configurado.
 */
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  // Opcional: permitir cambiar proveedor desde el body para testear antes de guardar
  const body = await req.json().catch(() => ({}));
  if (body.iaProveedor || body.nvidiaApiKey || body.nvidiaModelo) {
    // Temporalmente actualizar config para probar
    const { db } = await import("@/lib/db");
    await db.configEmpresa.upsert({
      where: { empresaId: user.empresaId },
      update: {
        ...(body.iaProveedor && { iaProveedor: body.iaProveedor }),
        ...(body.nvidiaApiKey && { nvidiaApiKey: body.nvidiaApiKey }),
        ...(body.nvidiaModelo && { nvidiaModelo: body.nvidiaModelo }),
      },
      create: {
        empresaId: user.empresaId,
        iaProveedor: body.iaProveedor || "nvidia",
        nvidiaApiKey: body.nvidiaApiKey,
        nvidiaModelo: body.nvidiaModelo,
      },
    });
  }

  const resultado = await probarConexion(user.empresaId);
  return ok(resultado);
}
