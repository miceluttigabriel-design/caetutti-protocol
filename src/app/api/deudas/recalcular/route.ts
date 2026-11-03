import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";

/**
 * POST /api/deudas/recalcular
 * Recalcula automáticamente:
 * - diasAtrasado (basado en fechaVcto vs hoy)
 * - interesGs (saldoGs × 0.001 × diasAtrasado)
 * - saldoTotalGs (saldoGs + interesGs)
 *
 * Solo procesa cuotas pendientes. Se puede llamar automáticamente
 * cada vez que se carga el dashboard o notificaciones.
 */
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // Buscar todas las cuotas pendientes
  const cuotas = await db.cuota.findMany({
    where: { empresaId: user.empresaId, estado: "pendiente" },
    select: { id: true, saldoGs: true, fechaVcto: true, diasAtrasado: true },
  });

  let actualizadas = 0;
  const batch: any[] = [];

  for (const q of cuotas) {
    const vcto = new Date(q.fechaVcto);
    vcto.setHours(0, 0, 0, 0);

    const diffMs = hoy.getTime() - vcto.getTime();
    const nuevosDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Solo actualizar si cambiaron los días
    if (nuevosDias !== q.diasAtrasado) {
      const interes = nuevosDias > 0 ? Math.round(q.saldoGs * 0.001 * nuevosDias) : 0;
      const saldoTotal = q.saldoGs + interes;

      batch.push(
        db.cuota.update({
          where: { id: q.id },
          data: {
            diasAtrasado: nuevosDias,
            interesGs: interes,
            saldoTotalGs: saldoTotal,
          },
        })
      );
      actualizadas++;
    }
  }

  // Ejecutar batch (en grupos de 50 para no saturar)
  for (let i = 0; i < batch.length; i += 50) {
    await Promise.all(batch.slice(i, i + 50));
  }

  return ok({
    totalCuotas: cuotas.length,
    actualizadas,
    mensaje: actualizadas > 0
      ? `${actualizadas} deudas actualizadas con nuevos días e interés`
      : "Todas las deudas ya están actualizadas",
  });
}
