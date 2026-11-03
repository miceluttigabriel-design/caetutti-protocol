import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return unauthorized();
  const { id } = await params;
  const body = await req.json();

  const regla = await db.regla.update({
    where: { id, empresaId: user.empresaId },
    data: {
      nombre: body.nombre,
      diasVcto: Number(body.diasVcto) ?? undefined,
      mensaje: body.mensaje,
      activa: body.activa,
      cooldownDias: Number(body.cooldownDias) ?? undefined,
      tipo: body.tipo,
      ordenPie: body.ordenPie != null ? Number(body.ordenPie) : undefined,
      diasMinPie: body.diasMinPie != null ? Number(body.diasMinPie) : undefined,
      diasMaxPie: body.diasMaxPie != null ? Number(body.diasMaxPie) : undefined,
    },
  });
  return ok({ regla });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return unauthorized();
  const { id } = await params;
  await db.regla.delete({ where: { id, empresaId: user.empresaId } });
  return ok({ success: true });
}
