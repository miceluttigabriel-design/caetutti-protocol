import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, unauthorized, sucursalFilter } from "@/lib/session";
import { recalcularInteresPorFecha } from "@/lib/interes";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const sucursalId = searchParams.get("sucursal");

  // === Recálculo automático de interés y días (optimizado) ===
  // Solo recalcula si la cuota tiene fecha de actualización vieja o si los datos están desactualizados
  // Esto asegura que el interés se mantenga actualizado día a día
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    // Buscar cuotas pendientes que necesiten recálculo
    // (cuya ultimaNotificacion o updatedAt sea de un día anterior al actual)
    const cuotasParaRecalc = await db.cuota.findMany({
      where: {
        empresaId: user.empresaId,
        estado: "pendiente",
        OR: [
          { updatedAt: { lt: hoy } },
          // Si los días de atraso no coinciden con la fecha actual, también recalcular
        ],
      },
      select: {
        id: true,
        saldoGs: true,
        fechaVcto: true,
        tasaInteresDiaria: true,
        interesGs: true,
        saldoTotalGs: true,
        diasAtrasado: true,
        interesManual: true,
      },
      take: 500, // limit para no demorar mucho
    });

    if (cuotasParaRecalc.length > 0) {
      // Recalcular en paralelo (más rápido)
      await Promise.all(cuotasParaRecalc.map(async (cuota) => {
        const recalc = recalcularInteresPorFecha(
          cuota.saldoGs,
          cuota.fechaVcto,
          cuota.tasaInteresDiaria
        );

        // Solo actualizar si cambió algo
        const cambioDias = (cuota.diasAtrasado || 0) !== recalc.diasAtrasado;

        if (cambioDias) {
          // Si la cuota tiene interesManual=true, NO recalcular el interés (respeta el valor del usuario)
          // Solo actualizar diasAtrasado y saldoTotalGs (saldoGs + interesGs)
          if (cuota.interesManual) {
            await db.cuota.update({
              where: { id: cuota.id },
              data: {
                diasAtrasado: recalc.diasAtrasado,
                saldoTotalGs: cuota.saldoGs + cuota.interesGs,
                // NO tocar interesGs (fue editado manualmente)
              },
            });
          } else {
            // Recalcular todo automáticamente
            await db.cuota.update({
              where: { id: cuota.id },
              data: {
                interesGs: recalc.interesGs,
                saldoTotalGs: recalc.saldoTotalGs,
                diasAtrasado: recalc.diasAtrasado,
              },
            });
          }
        }
      }));
    }
  } catch (e) {
    // Si falla el recálculo, continuar con los datos existentes
    console.error("[dashboard] Error en recálculo automático:", e);
  }

  const where: any = {
    empresaId: user.empresaId,
    ...sucursalFilter(user),
  };
  if (sucursalId && sucursalId !== "__TODAS__") {
    where.sucursalId = sucursalId;
  }

  const [cuotas, clientes, ventasMes, recordatorios, notificaciones] = await Promise.all([
    db.cuota.findMany({
      where: { ...where, estado: "pendiente" },
      select: {
        saldoGs: true,
        saldoTotalGs: true,
        interesGs: true,
        diasAtrasado: true,
        fechaVcto: true,
        notificado: true,
      },
    }),
    db.cliente.count({ where }),
    db.ventaMes.aggregate({
      where: { empresaId: user.empresaId },
      _sum: { totalVendido: true },
    }),
    db.recordatorio.count({
      where: { empresaId: user.empresaId, estado: "pendiente" },
    }),
    db.notificacion.count({
      where: { empresaId: user.empresaId },
    }),
  ]);

  const totalPendiente = cuotas.reduce((s, c) => s + (c.saldoTotalGs || c.saldoGs), 0);
  const totalInteres = cuotas.reduce((s, c) => s + (c.interesGs || 0), 0);
  const totalCuotas = cuotas.length;
  const notificadas = cuotas.filter((c) => c.notificado).length;
  const sinNotificar = totalCuotas - notificadas;

  const hoy = new Date();
  const vencidas = cuotas.filter((c) => c.diasAtrasado > 0);
  const porVencer = cuotas.filter((c) => c.diasAtrasado <= 0 && c.diasAtrasado >= -7);
  const criticas = cuotas.filter((c) => c.diasAtrasado > 30);

  const totalVencido = vencidas.reduce((s, c) => s + (c.saldoTotalGs || c.saldoGs), 0);
  const totalPorVencer = porVencer.reduce((s, c) => s + (c.saldoTotalGs || c.saldoGs), 0);
  const totalCritico = criticas.reduce((s, c) => s + (c.saldoTotalGs || c.saldoGs), 0);

  // Bucket por dias de atraso
  const buckets = [
    { label: "Por vencer", rango: "< 0", count: 0, monto: 0 },
    { label: "0-7 días", rango: "0-7", count: 0, monto: 0 },
    { label: "8-30 días", rango: "8-30", count: 0, monto: 0 },
    { label: "31-60 días", rango: "31-60", count: 0, monto: 0 },
    { label: "61-90 días", rango: "61-90", count: 0, monto: 0 },
    { label: "+90 días", rango: ">90", count: 0, monto: 0 },
  ];
  for (const c of cuotas) {
    const d = c.diasAtrasado;
    let idx = 0;
    if (d < 0) idx = 0;
    else if (d <= 7) idx = 1;
    else if (d <= 30) idx = 2;
    else if (d <= 60) idx = 3;
    else if (d <= 90) idx = 4;
    else idx = 5;
    buckets[idx].count++;
    buckets[idx].monto += (c.saldoTotalGs || c.saldoGs);
  }

  // Tasa de cobranza
  const totalVendido = ventasMes._sum.totalVendido || 0;
  const tasaCobranza =
    totalVendido > 0
      ? ((totalVendido - totalPendiente) / totalVendido) * 100
      : 0;

  return ok({
    kpis: {
      totalPendiente,
      totalInteres,
      totalCuotas,
      totalClientes: clientes,
      totalVendido,
      tasaCobranza,
      totalVencido,
      totalPorVencer,
      totalCritico,
      notificadas,
      sinNotificar,
      recordatoriosPendientes: recordatorios,
      notificacionesEnviadas: notificaciones,
    },
    buckets,
    tendencia: [], // se llenará abajo
  });
}

// Helper export
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
