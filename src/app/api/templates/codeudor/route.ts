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
  // 🛠️ FIX: permitir detalle y pieEstatico VACÍOS (string "")
  // Así el usuario puede armar un mensaje simple sin la sección "Vence · Saldo · días".
  // Solo validamos que cabecera tenga algo (es el saludo mínimo del mensaje).
  const cabecera = typeof body.cabecera === "string" ? body.cabecera : "";
  const detalle = typeof body.detalle === "string" ? body.detalle : "";
  const pieEstatico = typeof body.pieEstatico === "string" ? body.pieEstatico : null;
  const usarReglasDinamicas = body.usarReglasDinamicas !== false;

  if (!cabecera.trim()) {
    return fail("La cabecera es obligatoria (no puede estar vacía)");
  }

  const template = await db.templateCodeudor.upsert({
    where: { empresaId: user.empresaId },
    update: {
      cabecera, detalle,
      pieEstatico,
      usarReglasDinamicas,
    },
    create: {
      empresaId: user.empresaId,
      cabecera, detalle,
      pieEstatico,
      usarReglasDinamicas,
    },
  });

  return ok({ template });
}
