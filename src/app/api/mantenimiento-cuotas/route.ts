import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized, sucursalFilter } from "@/lib/session";

/**
 * GET /api/mantenimiento-cuotas
 * Lista cuotas con filtros avanzados para mantenimiento masivo.
 *
 * Query params:
 *   sucursal, estado, dias_min, dias_max, fecha_desde, fecha_hasta, search
 */
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const sucursalId = searchParams.get("sucursal");
  const estado = searchParams.get("estado"); // pendiente | cobrada
  const diasMin = searchParams.get("dias_min");
  const diasMax = searchParams.get("dias_max");
  const fechaDesde = searchParams.get("fecha_desde");
  const fechaHasta = searchParams.get("fecha_hasta");
  const search = searchParams.get("search");

  const where: any = {
    empresaId: user.empresaId,
    ...sucursalFilter(user),
  };
  if (estado) where.estado = estado;
  if (sucursalId && sucursalId !== "__TODAS__") where.sucursalId = sucursalId;
  if (diasMin) where.diasAtrasado = { ...(where.diasAtrasado || {}), gte: Number(diasMin) };
  if (diasMax) where.diasAtrasado = { ...(where.diasAtrasado || {}), lte: Number(diasMax) };
  if (fechaDesde) where.fechaVcto = { ...(where.fechaVcto || {}), gte: new Date(fechaDesde) };
  if (fechaHasta) where.fechaVcto = { ...(where.fechaVcto || {}), lte: new Date(fechaHasta) };
  if (search) {
    where.OR = [
      { cliente: { entidad: { contains: search } } },
      { cliente: { codigoEntidad: { contains: search } } },
      { descripcion: { contains: search } },
    ];
  }

  const cuotas = await db.cuota.findMany({
    where,
    include: {
      cliente: { select: { codigoEntidad: true, entidad: true, telefono: true } },
      sucursal: { select: { nombre: true } },
      codeudor: { select: { codigoEntidad: true, entidad: true } },
    },
    orderBy: { fechaVcto: "asc" },
    take: 500,
  });

  return ok({ cuotas, total: cuotas.length });
}

/**
 * POST /api/mantenimiento-cuotas
 * Operaciones masivas sobre cuotas filtradas.
 *
 * Body: {
 *   action: "marcar_cobradas" | "marcar_pendientes",
 *   filters: { sucursal, estado, dias_min, dias_max, fecha_desde, fecha_hasta }
 * }
 */
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const body = await req.json();
  const { action, filters = {} } = body;

  const where: any = {
    empresaId: user.empresaId,
    ...sucursalFilter(user),
  };
  if (filters.sucursal && filters.sucursal !== "__TODAS__") where.sucursalId = filters.sucursal;
  if (filters.estado) where.estado = filters.estado;
  if (filters.dias_min != null) where.diasAtrasado = { ...(where.diasAtrasado || {}), gte: Number(filters.dias_min) };
  if (filters.dias_max != null) where.diasAtrasado = { ...(where.diasAtrasado || {}), lte: Number(filters.dias_max) };
  if (filters.fecha_desde) where.fechaVcto = { ...(where.fechaVcto || {}), gte: new Date(filters.fecha_desde) };
  if (filters.fecha_hasta) where.fechaVcto = { ...(where.fechaVcto || {}), lte: new Date(filters.fecha_hasta) };

  let result;
  if (action === "marcar_cobradas") {
    result = await db.cuota.updateMany({ where, data: { estado: "cobrada" } });
  } else if (action === "marcar_pendientes") {
    result = await db.cuota.updateMany({ where, data: { estado: "pendiente" } });
  } else {
    return fail("Acción no válida. Use: marcar_cobradas | marcar_pendientes");
  }

  return ok({ affected: result.count });
}
