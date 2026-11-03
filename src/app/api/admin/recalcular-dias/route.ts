import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/recalcular-dias
 *
 * Recalcula masivamente los diasAtrasado de TODAS las cuotas pendientes.
 * También recalcula el interesGs (si no es interesManual) basado en los días.
 *
 * Requiere permiso de admin.
 *
 * Body (opcional):
 *   { empresaId?: string }  // si no se pasa, usa la del usuario logueado
 */
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();
  if (user.rol !== "admin") {
    return fail("Solo el admin puede ejecutar esta acción", 403);
  }

  // Traer todas las cuotas pendientes con los datos necesarios
  const cuotas = await db.cuota.findMany({
    where: {
      empresaId: user.empresaId,
      estado: "pendiente",
    },
    select: {
      id: true,
      fechaVcto: true,
      saldoGs: true,
      diasAtrasado: true,
      interesGs: true,
      interesManual: true,
      tasaInteresDiaria: true,
      montoEditado: true,
    },
  });

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  let actualizadas = 0;
  let sinCambios = 0;
  let errores = 0;

  // Procesar en lotes de 50 para no sobrecargar la DB
  const LOTES = 50;
  for (let i = 0; i < cuotas.length; i += LOTES) {
    const lote = cuotas.slice(i, i + LOTES);
    await Promise.all(
      lote.map(async (q) => {
        try {
          const vcto = new Date(q.fechaVcto);
          vcto.setHours(0, 0, 0, 0);
          const diffMs = hoy.getTime() - vcto.getTime();
          const diasCalculados = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

          // Si no cambió nada, saltar
          if (diasCalculados === q.diasAtrasado) {
            sinCambios++;
            return;
          }

          // Recalcular interés solo si NO es manual
          // Fórmula: saldoGs * tasaInteresDiaria * diasAtrasado
          const tasa = q.tasaInteresDiaria ?? 0.001;
          const nuevoInteres = q.interesManual
            ? q.interesGs  // mantener el interés manual
            : Math.round((q.saldoGs || 0) * tasa * diasCalculados);

          const nuevoTotal = (q.saldoGs || 0) + nuevoInteres;

          await db.cuota.update({
            where: { id: q.id },
            data: {
              diasAtrasado: diasCalculados,
              interesGs: nuevoInteres,
              saldoTotalGs: nuevoTotal,
            },
          });
          actualizadas++;
        } catch (e: any) {
          errores++;
        }
      })
    );
  }

  return ok({
    mensaje: "Recálculo completado",
    totalCuotas: cuotas.length,
    actualizadas,
    sinCambios,
    errores,
    fechaCalculo: hoy.toISOString(),
  });
}
