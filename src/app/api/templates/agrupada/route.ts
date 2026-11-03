import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";

/**
 * GET /api/templates/agrupada — devuelve el template agrupado de la empresa
 */
export async function GET() {
  const user = await getSession();
  if (!user) return unauthorized();

  let template = await db.templateAgrupada.findUnique({
    where: { empresaId: user.empresaId },
  });

  if (!template) {
    template = await db.templateAgrupada.create({
      data: {
        empresaId: user.empresaId,
        cabecera: "Estimado/a {Entidad}, tiene cuotas pendientes por un total de ₲ {Total Gs}.",
        detalle: "- Vence: {Fecha Vcto} · Saldo: ₲ {Saldo en Gs} · {dias_texto}",
        pieEstatico: "Comuníquese al 021 123 456 para regularizar. Gracias.",
        usarReglasDinamicas: true,
      },
    });
  }

  return ok({ template });
}

/**
 * PUT /api/templates/agrupada — actualiza el template
 */
export async function PUT(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const body = await req.json();
  const { cabecera, detalle, pieEstatico, usarReglasDinamicas } = body;

  if (!cabecera || !detalle) {
    return fail("cabecera y detalle son requeridos");
  }

  const template = await db.templateAgrupada.upsert({
    where: { empresaId: user.empresaId },
    update: {
      cabecera,
      detalle,
      pieEstatico: pieEstatico || null,
      usarReglasDinamicas: usarReglasDinamicas !== false,
    },
    create: {
      empresaId: user.empresaId,
      cabecera,
      detalle,
      pieEstatico: pieEstatico || null,
      usarReglasDinamicas: usarReglasDinamicas !== false,
    },
  });

  return ok({ template });
}
