import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";

export async function GET() {
  const user = await getSession();
  if (!user) return unauthorized();

  let template = await db.templateCodeudor.findUnique({
    where: { empresaId: user.empresaId },
  });

  if (!template) {
    template = await db.templateCodeudor.create({
      data: {
        empresaId: user.empresaId,
        cabecera: "Estimado/a codeudor, le informamos que el cliente {Entidad} tiene cuotas pendientes por un total de ₲ {Total Gs}.",
        detalle: "- Vence: {Fecha Vcto} · Saldo: ₲ {Saldo en Gs} · {dias_texto}",
        pieEstatico: "Le solicitamos gestionar el pago. Gracias.",
        usarReglasDinamicas: true,
      },
    });
  }

  return ok({ template });
}

export async function PUT(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const body = await req.json();
  const { cabecera, detalle, pieEstatico, usarReglasDinamicas } = body;

  if (!cabecera || !detalle) {
    return fail("cabecera y detalle son requeridos");
  }

  const template = await db.templateCodeudor.upsert({
    where: { empresaId: user.empresaId },
    update: {
      cabecera, detalle,
      pieEstatico: pieEstatico || null,
      usarReglasDinamicas: usarReglasDinamicas !== false,
    },
    create: {
      empresaId: user.empresaId,
      cabecera, detalle,
      pieEstatico: pieEstatico || null,
      usarReglasDinamicas: usarReglasDinamicas !== false,
    },
  });

  return ok({ template });
}
