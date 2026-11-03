import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized, sucursalFilter } from "@/lib/session";

export async function GET() {
  const user = await getSession();
  if (!user) return unauthorized();

  const clientes = await db.cliente.findMany({
    where: { empresaId: user.empresaId, ...sucursalFilter(user) },
    include: {
      sucursal: { select: { nombre: true } },
      _count: { select: { cuotas: { where: { estado: "pendiente" } } } },
    },
    orderBy: { entidad: "asc" },
  });

  // Add computed saldoTotal + última notificación
  const clientesWithSaldo = await Promise.all(
    clientes.map(async (c) => {
      const agg = await db.cuota.aggregate({
        where: { clienteId: c.id, estado: "pendiente" },
        _sum: { saldoGs: true, saldoTotalGs: true, interesGs: true },
      });
      // Última notificación: buscar la cuota pendiente con ultimaNotificacion más reciente
      const ultimaCuotaNotif = await db.cuota.findFirst({
        where: { clienteId: c.id, ultimaNotificacion: { not: null } },
        orderBy: { ultimaNotificacion: "desc" },
        select: { ultimaNotificacion: true, notificado: true },
      });
      const algunaNotificada = await db.cuota.findFirst({
        where: { clienteId: c.id, notificado: true },
        select: { id: true },
      });
      return {
        ...c,
        saldoTotal: agg._sum.saldoTotalGs || agg._sum.saldoGs || 0,
        saldoSinInteres: agg._sum.saldoGs || 0,
        interesTotal: agg._sum.interesGs || 0,
        cuotasPendientes: c._count.cuotas,
        ultimaNotificacion: ultimaCuotaNotif?.ultimaNotificacion || null,
        notificado: !!algunaNotificada,
      };
    })
  );

  return ok({ clientes: clientesWithSaldo });
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
