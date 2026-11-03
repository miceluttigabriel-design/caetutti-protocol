import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";

/**
 * GET /api/whatsapp/templates — lista plantillas locales
 */
export async function GET() {
  const user = await getSession();
  if (!user) return unauthorized();

  const templates = await db.metaTemplate.findMany({
    where: { empresaId: user.empresaId },
    orderBy: { createdAt: "desc" },
  });

  return ok({ templates });
}

/**
 * POST /api/whatsapp/templates — crea una plantilla localmente
 * (Para enviarla a Meta para aprobación, usar POST /api/whatsapp/templates/sync)
 *
 * Body: {
 *   nombre: "recordatorio_vencimiento",
 *   idioma: "es",
 *   categoria: "UTILITY" | "MARKETING",
 *   cuerpo: "Hola {{1}}, su cuota de ₲ {{2}} vence el {{3}}. Regularice...",
 *   variables: ["Entidad", "Saldo en Gs", "Fecha Vcto"]  // descriptivo
 * }
 */
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const body = await req.json();
  const { nombre, idioma, categoria, cuerpo, variables } = body;

  if (!nombre || !cuerpo) return fail("nombre y cuerpo son requeridos");

  // Sanitizar nombre: solo lowercase, números y _
  const metaNombre = nombre.toLowerCase().replace(/[^a-z0-9_]/g, "_");

  try {
    const template = await db.metaTemplate.create({
      data: {
        empresaId: user.empresaId,
        nombre,
        metaNombre,
        idioma: idioma || "es",
        categoria: categoria || "UTILITY",
        cuerpo,
        variables: JSON.stringify(variables || []),
        estado: "pendiente",
      },
    });

    return ok({ template });
  } catch (e: any) {
    if (e.code === "P2002") {
      return fail("Ya existe una plantilla con ese nombre", 409);
    }
    return fail(e.message, 500);
  }
}
