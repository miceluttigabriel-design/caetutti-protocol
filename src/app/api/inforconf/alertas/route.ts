import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, unauthorized, sucursalFilter } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/inforconf/alertas
 *
 * Lista los clientes marcados como INFORCONF="S" que NO tienen cuotas pendientes.
 * Estos clientes generan alerta: están en INFORCONF pero no figuran con deuda
 * activa en el sistema (probablemente porque no vinieron en el Excel importado).
 *
 * Query params:
 *   ?sucursal=ID     — filtrar por sucursal (default: todas las del usuario)
 *
 * Response:
 *   { alertas: [{ id, entidad, codigoEntidad, telefono, localidad, sucursal, judicial, ultimaNotificacion }], total }
 */
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const sucursalId = searchParams.get("sucursal");
  const sucursalWhere =
    sucursalId && sucursalId !== "__TODAS__"
      ? { sucursalId }
      : sucursalFilter(user);

  // Clientes con informconf="S" que NO tienen ninguna cuota pendiente
  const clientes = await db.cliente.findMany({
    where: {
      empresaId: user.empresaId,
      ...sucursalWhere,
      informconf: "S",
      cuotas: {
        none: { estado: "pendiente" },
      },
    },
    include: {
      sucursal: { select: { nombre: true } },
    },
    orderBy: { entidad: "asc" },
  });

  // Buscar última notificación de cada cliente (de cualquier cuota, incluso cobradas)
  const clienteIds = clientes.map((c) => c.id);
  const notifs = await db.notificacion.findMany({
    where: { clienteId: { in: clienteIds } },
    orderBy: { createdAt: "desc" },
    distinct: ["clienteId"],
    select: { clienteId: true, createdAt: true },
  });
  const ultMap = new Map(notifs.map((n) => [n.clienteId, n.createdAt]));

  const alertas = clientes.map((c) => ({
    id: c.id,
    entidad: c.entidad,
    codigoEntidad: c.codigoEntidad,
    ciEntidad: c.ciEntidad || "",
    telefono: c.telefono || "",
    localidad: c.localidad || "",
    vendedor: c.vendedor || "",
    sucursal: c.sucursal?.nombre || "—",
    judicial: c.judicial === "S",
    ultimaNotificacion: ultMap.get(c.id) || null,
  }));

  return ok({ alertas, total: alertas.length });
}
