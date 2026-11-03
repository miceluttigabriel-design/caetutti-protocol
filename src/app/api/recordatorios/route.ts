import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized, sucursalFilter } from "@/lib/session";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const estado = searchParams.get("estado"); // pendiente | completado | vencido

  const where: any = {
    empresaId: user.empresaId,
    ...sucursalFilter(user),
  };
  if (estado) where.estado = estado;

  const recordatorios = await db.recordatorio.findMany({
    where,
    include: {
      cliente: { select: { codigoEntidad: true, entidad: true, telefono: true } },
      cuota: { select: { saldoGs: true, fechaVcto: true } },
      usuario: { select: { nombre: true } },
    },
    orderBy: { fechaCompromiso: "asc" },
  });

  return ok({ recordatorios });
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const body = await req.json();
  const { clienteId, cuotaId, fechaCompromiso, descripcion } = body;

  if (!clienteId || !fechaCompromiso) {
    return fail("clienteId y fechaCompromiso son requeridos");
  }

  const r = await db.recordatorio.create({
    data: {
      empresaId: user.empresaId,
      clienteId,
      cuotaId: cuotaId || null,
      fechaCompromiso: new Date(fechaCompromiso),
      descripcion: descripcion || null,
      creadoPor: user.id,
      estado: "pendiente",
    },
  });

  return ok({ recordatorio: r });
}

export async function PATCH(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const body = await req.json();
  const { id, estado } = body;
  if (!id || !estado) return fail("id y estado son requeridos");

  const r = await db.recordatorio.update({
    where: { id, empresaId: user.empresaId },
    data: { estado },
  });

  return ok({ recordatorio: r });
}
