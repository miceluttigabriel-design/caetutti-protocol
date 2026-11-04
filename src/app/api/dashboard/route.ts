import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, unauthorized, sucursalFilter } from "@/lib/session";
import { recalcularInteresPorFecha } from "@/lib/interes";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const sucursalId = searchParams.get("sucursal");

  // === Recálculo automático de interés y días (optimizado) ===
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const cuotasParaRecalc = await db.cuota.findMany({
      where: {
        empresaId: user.empresaId,
        estado: "pendiente",
        updatedAt: { lt: hoy },
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
      take: 500,
    });

    if (cuotasParaRecalc.length > 0) {
      await Promise.all(cuotasParaRecalc.map(async (cuota) => {
        const recalc = recalcularInteresPorFecha(
          cuota.saldoGs,
          cuota.fechaVcto,
          cuota.tasaInteresDiaria
        );
        const cambioDias = (cuota.diasAtrasado || 0) !== recalc.diasAtrasado;
        if (cambioDias) {
          if (cuota.interesManual) {
            await db.cuota.update({
              where: { id: cuota.id },
              data: {
                diasAtrasado: recalc.diasAtrasado,
                saldoTotalGs: cuota.saldoGs + cuota.interesGs,
              },
            });
          } else {
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
    console.error("[dashboard] Error en recálculo automático:", e);
  }

  // === FIX SUCURSAL: aplicar filtro a TODAS las queries ===
  const where: any = {
    empresaId: user.empresaId,
    ...sucursalFilter(user),
  };
  if (sucursalId && sucursalId !== "__TODAS__") {
    where.sucursalId = sucursalId;
  }

  // Where para ventasMes (mismo filtro de sucursal)
  const whereVentas: any = { empresaId: user.empresaId };
  if (sucursalId && sucursalId !== "__TODAS__") {
    whereVentas.sucursalId = sucursalId;
  } else if (user.sucursalId) {
    // Si el usuario tiene sucursal asignada (no admin), filtrar por la suya
    whereVentas.sucursalId = user.sucursalId;
  }

  // === Calcular período del mes actual ===
  // Desde el día 1 del mes actual hasta el último día del mes actual
  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1, 0, 0, 0, 0);
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999);
  // finMes = último día del mes actual (usando día 0 del mes siguiente)

  const [cuotas, clientes, ventasMes, recordatorios, notificaciones, cuotasDelMes] = await Promise.all([
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
      where: whereVentas,  // FIX: ahora filtra por sucursal
      _sum: { totalVendido: true },
    }),
    db.recordatorio.count({
      where: { empresaId: user.empresaId, estado: "pendiente" },
    }),
    db.notificacion.count({
      where: { empresaId: user.empresaId },
    }),
    // === NUEVO: cuotas con fechaVcto en el mes actual (todas, cobradas y pendientes) ===
    db.cuota.findMany({
      where: {
        ...where,  // respeta filtro de sucursal
        fechaVcto: {
          gte: inicioMes,
          lte: finMes,
        },
      },
      select: {
        saldoGs: true,
        saldoTotalGs: true,
        estado: true,
        fechaVcto: true,
      },
    }),
  ]);

  // 🛠️ FIX: "Saldo Por Cobrar" = solo saldoGs (sin interés, no cuadra con Excel)
  const totalPendiente = cuotas.reduce((s, c) => s + (c.saldoGs || 0), 0);
  const totalInteres = 0; // no se usa — dejamos en 0 para no mostrar interés en UI
  const totalCuotas = cuotas.length;
  const notificadas = cuotas.filter((c) => c.notificado).length;
  const sinNotificar = totalCuotas - notificadas;

  const vencidas = cuotas.filter((c) => c.diasAtrasado > 0);
  const porVencer = cuotas.filter((c) => c.diasAtrasado <= 0 && c.diasAtrasado >= -7);
  const criticas = cuotas.filter((c) => c.diasAtrasado > 30);

  const totalVencido = vencidas.reduce((s, c) => s + (c.saldoGs || 0), 0);
  const totalPorVencer = porVencer.reduce((s, c) => s + (c.saldoGs || 0), 0);
  const totalCritico = criticas.reduce((s, c) => s + (c.saldoGs || 0), 0);

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
    buckets[idx].monto += (c.saldoGs || 0);
  }

  // === Tasa de cobranza general (sobre el total vendido) ===
  const totalVendido = ventasMes._sum.totalVendido || 0;
  const tasaCobranza =
    totalVendido > 0
      ? ((totalVendido - totalPendiente) / totalVendido) * 100
      : 0;

  // === NUEVO: % Recuperado del Mes ===
  // Cuotas con fechaVcto en el mes actual, separadas por estado
  const cuotasMesCobradas = cuotasDelMes.filter((c) => c.estado === "cobrada");
  const cuotasMesPendientes = cuotasDelMes.filter((c) => c.estado === "pendiente");

  const totalCuotasMes = cuotasDelMes.length;
  const totalCobradasMes = cuotasMesCobradas.length;
  const totalPendientesMes = cuotasMesPendientes.length;

  // Montos: para las cobradas usamos saldoGs (lo que se cobró); para pendientes también saldoGs (sin interés)
  const montoCobradoMes = cuotasMesCobradas.reduce((s, c) => s + (c.saldoGs || 0), 0);
  const montoPendienteMes = cuotasMesPendientes.reduce((s, c) => s + (c.saldoGs || 0), 0);
  const montoTotalMes = montoCobradoMes + montoPendienteMes;

  // % recuperado = cobrado / total * 100
  const pctRecuperadoMes = montoTotalMes > 0
    ? (montoCobradoMes / montoTotalMes) * 100
    : 0;

  // Período para mostrar en la UI
  const periodoMes = {
    inicio: inicioMes.toISOString(),
    fin: finMes.toISOString(),
    inicioStr: inicioMes.toLocaleDateString("es-PY"),
    finStr: finMes.toLocaleDateString("es-PY"),
    mesNombre: inicioMes.toLocaleDateString("es-PY", { month: "long", year: "numeric" }),
  };

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
    // === NUEVOS KPIs del mes ===
    mes: {
      pctRecuperado: pctRecuperadoMes,
      montoCobrado: montoCobradoMes,
      montoPendiente: montoPendienteMes,
      montoTotal: montoTotalMes,
      cuotasCobradas: totalCobradasMes,
      cuotasPendientes: totalPendientesMes,
      cuotasTotal: totalCuotasMes,
      periodo: periodoMes,
    },
    buckets,
    tendencia: [],
  });
}
