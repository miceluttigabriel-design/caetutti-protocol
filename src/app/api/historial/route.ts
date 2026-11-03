import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, unauthorized, sucursalFilter } from "@/lib/session";

/**
 * GET /api/historial
 * Historial completo de notificaciones enviadas.
 * ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&sucursal=ID&search=texto
 */
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const sucursalId = searchParams.get("sucursal");
  const search = searchParams.get("search");

  const where: any = {
    empresaId: user.empresaId,
  };
  if (desde) where.createdAt = { ...(where.createdAt || {}), gte: new Date(desde) };
  if (hasta) {
    const h = new Date(hasta);
    h.setDate(h.getDate() + 1);
    where.createdAt = { ...(where.createdAt || {}), lt: h };
  }
  if (sucursalId && sucursalId !== "__TODAS__") {
    where.cliente = { sucursalId };
  }
  if (search) {
    where.OR = [
      { cliente: { entidad: { contains: search } } },
      { telefono: { contains: search } },
      { mensaje: { contains: search } },
    ];
  }

  const notifs = await db.notificacion.findMany({
    where,
    include: {
      cliente: {
        select: { codigoEntidad: true, entidad: true, sucursal: { select: { nombre: true } } },
      },
      usuario: { select: { nombre: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const total = notifs.length;
  const porEstado = notifs.reduce((acc, n) => {
    acc[n.estado] = (acc[n.estado] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return ok({ notificaciones: notifs, total, porEstado });
}
