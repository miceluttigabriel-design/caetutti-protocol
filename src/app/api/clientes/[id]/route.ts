import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) return unauthorized();
  const { id } = await params;

  const body = await req.json();
  try {
    const cliente = await db.cliente.update({
      where: { id, empresaId: user.empresaId },
      data: {
        entidad: body.entidad,
        ciEntidad: body.ciEntidad,
        rucEntidad: body.rucEntidad,
        localidad: body.localidad,
        telefono: body.telefono,
        telefonoPivot: body.telefonoPivot,
        sucursalId: body.sucursalId,
        vendedor: body.vendedor,
        cobrador: body.cobrador,
        judicial: body.judicial,
        informconf: body.informconf,
      },
    });
    return ok({ cliente });
  } catch (e: any) {
    return fail(e.message || "Error al actualizar", 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) return unauthorized();
  const { id } = await params;

  try {
    await db.cliente.delete({ where: { id, empresaId: user.empresaId } });
    return ok({ success: true });
  } catch (e: any) {
    return fail(e.message || "Error al eliminar", 500);
  }
}
