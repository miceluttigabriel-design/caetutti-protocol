import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";

export async function GET() {
  const user = await getSession();
  if (!user) return unauthorized();

  const objetivos = await db.objetivoDinamico.findMany({
    where: { empresaId: user.empresaId, activo: true },
    orderBy: [{ orden: "asc" }],
    include: { sucursal: { select: { nombre: true } } },
  });

  return ok({ objetivos });
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const body = await req.json();
  const { mesesAtras, sucursalId, descripcion, porcentaje, orden } = body;

  if (!descripcion || porcentaje === undefined) {
    return fail("descripcion y porcentaje son requeridos");
  }

  const obj = await db.objetivoDinamico.create({
    data: {
      empresaId: user.empresaId,
      mesesAtras: Number(mesesAtras) || 0,
      sucursalId: sucursalId || null,
      descripcion,
      porcentaje: Number(porcentaje),
      orden: Number(orden) || 0,
    },
  });

  return ok({ objetivo: obj });
}

export async function DELETE(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return fail("id requerido");

  await db.objetivoDinamico.delete({ where: { id, empresaId: user.empresaId } });
  return ok({ success: true });
}
