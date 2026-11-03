import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";

export async function GET() {
  const user = await getSession();
  if (!user) return unauthorized();

  const ventas = await db.ventaMes.findMany({
    where: { empresaId: user.empresaId },
    include: { sucursal: { select: { nombre: true } } },
    orderBy: { anhoMes: "desc" },
  });

  return ok({ ventas });
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const body = await req.json();
  const { anhoMes, totalVendido, sucursalId } = body;

  if (!anhoMes || totalVendido === undefined) {
    return fail("anhoMes y totalVendido son requeridos");
  }

  const existing = await db.ventaMes.findFirst({
    where: { empresaId: user.empresaId, anhoMes, sucursalId: sucursalId || null },
  });

  if (existing) {
    const venta = await db.ventaMes.update({
      where: { id: existing.id },
      data: { totalVendido: Number(totalVendido) },
    });
    return ok({ venta });
  }

  const venta = await db.ventaMes.create({
    data: {
      empresaId: user.empresaId,
      sucursalId: sucursalId || null,
      anhoMes,
      totalVendido: Number(totalVendido),
    },
  });
  return ok({ venta });
}

export async function DELETE(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return fail("id requerido");

  await db.ventaMes.delete({ where: { id, empresaId: user.empresaId } });
  return ok({ success: true });
}
