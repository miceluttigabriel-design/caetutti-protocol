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
 * 🛠️ FIX: permite detalle y pieEstatico VACÍOS (string "") para que el usuario
 * pueda armar un mensaje simple sin la sección "Vence · Saldo · días".
 * Solo la cabecera es obligatoria (saludo mínimo del mensaje).
 */
export async function PUT(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const body = await req.json();
  const cabecera = typeof body.cabecera === "string" ? body.cabecera : "";
  const detalle = typeof body.detalle === "string" ? body.detalle : "";
  const pieEstatico = typeof body.pieEstatico === "string" ? body.pieEstatico : null;
  const usarReglasDinamicas = body.usarReglasDinamicas !== false;

  if (!cabecera.trim()) {
    return fail("La cabecera es obligatoria (no puede estar vacía)");
  }

  const template = await db.templateAgrupada.upsert({
    where: { empresaId: user.empresaId },
    update: {
      cabecera,
      detalle,
      pieEstatico,
      usarReglasDinamicas,
    },
    create: {
      empresaId: user.empresaId,
      cabecera,
      detalle,
      pieEstatico,
      usarReglasDinamicas,
    },
  });

  return ok({ template });
}
