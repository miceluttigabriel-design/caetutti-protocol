import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized, sucursalFilter } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * ⚡ OPTIMIZADO PARA VELOCIDAD
 *
 * Antes: 1 consulta de clientes + 3 consultas POR CADA CLIENTE
 *        (aggregate + 2 findFirst) = ~8.500 consultas con 2.824 clientes.
 *        Eso tardaba 30-120 segundos o directamentе expiraba.
 *
 * Ahora: 4 consultas TOTALES en paralelo (1 findMany + 3 groupBy)
 *        y el cruce se hace en memoria con Mapas (instantáneo).
 *        La respuesta tiene EXACTAMENTE la misma forma que antes,
 *        por eso el frontend no necesita cambios de estructura.
 */
export async function GET() {
  const user = await getSession();
  if (!user) return unauthorized();

  const [clientes, aggSaldo, aggNotificado, aggUltimaNotif] = await Promise.all([
    // 1) Clientes de la empresa / sucursales permitidas
    db.cliente.findMany({
      where: { empresaId: user.empresaId, ...sucursalFilter(user) },
      include: { sucursal: { select: { nombre: true } } },
      orderBy: { entidad: "asc" },
    }),

    // 2) Suma de saldos + cantidad de cuotas pendientes POR CLIENTE (1 sola query)
    db.cuota.groupBy({
      by: ["clienteId"],
      where: { estado: "pendiente" },
      _sum: { saldoGs: true, saldoTotalGs: true, interesGs: true },
      _count: { _all: true },
    }),

    // 3) Clientes que tienen al menos una cuota notificada
    db.cuota.groupBy({
      by: ["clienteId"],
      where: { notificado: true },
      _count: { _all: true },
    }),

    // 4) Última notificación POR CLIENTE (fecha más reciente)
    db.cuota.groupBy({
      by: ["clienteId"],
      where: { ultimaNotificacion: { not: null } },
      _max: { ultimaNotificacion: true },
    }),
  ]);

  // Mapas para lookup O(1) — cruce en memoria, sin tocar más la BD
  const saldoMap = new Map(aggSaldo.map((r) => [r.clienteId, r]));
  const notificados = new Set(aggNotificado.map((r) => r.clienteId));
  const ultimaMap = new Map(
    aggUltimaNotif.map((r) => [r.clienteId, r._max.ultimaNotificacion] as const)
  );

  const clientesConSaldo = clientes.map((c) => {
    const s = saldoMap.get(c.id);
    const sum = s?._sum;
    return {
      ...c,
      saldoTotal: sum?.saldoTotalGs || sum?.saldoGs || 0,
      saldoSinInteres: sum?.saldoGs || 0,
      interesTotal: sum?.interesGs || 0,
      cuotasPendientes: s?._count?._all ?? 0,
      ultimaNotificacion: ultimaMap.get(c.id) || null,
      notificado: notificados.has(c.id),
    };
  });

  return ok({ clientes: clientesConSaldo });
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const body = await req.json();
  const {
    codigoEntidad, entidad, ciEntidad, rucEntidad, localidad,
    telefono, telefonoPivot, sucursalId, vendedor, cobrador,
  } = body;

  if (!codigoEntidad || !entidad) {
    return fail("codigoEntidad y entidad son requeridos");
  }

  try {
    const cliente = await db.cliente.create({
      data: {
        empresaId: user.empresaId,
        sucursalId: sucursalId || null,
        codigoEntidad,
        entidad,
        ciEntidad,
        rucEntidad,
        localidad,
        telefono,
        telefonoPivot,
        vendedor,
        cobrador,
      },
    });
    return ok({ cliente });
  } catch (e: any) {
    if (e.code === "P2002") {
      return fail("Ya existe un cliente con ese código", 409);
    }
    return fail(e.message || "Error al crear cliente", 500);
  }
}
