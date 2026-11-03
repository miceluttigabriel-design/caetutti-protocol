import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";

/**
 * PATCH /api/cuotas/[id]/monto
 * Actualiza el saldoGs de una deuda y recalcula el interés automáticamente.
 *
 * Body: { saldoGs: number }
 *
 * Esto se usa cuando el usuario edita el monto antes de enviar la notificación.
 * El nuevo monto se guarda permanentemente y el interés se recalcula.
 * El mismo valor se usa para notificar al codeudor (porque lee de la misma cuota).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return unauthorized();
  const { id } = await params;

  const body = await req.json();
  const { saldoGs } = body;

  if (saldoGs === undefined || isNaN(Number(saldoGs))) {
    return fail("saldoGs requerido y debe ser un número");
  }

  const nuevoSaldo = Number(saldoGs);

  // Buscar la cuota
  const cuota = await db.cuota.findFirst({
    where: { id, empresaId: user.empresaId },
    select: { id: true, diasAtrasado: true, tasaInteresDiaria: true },
  });
  if (!cuota) return fail("Deuda no encontrada", 404);

  // Recalcular interés con el nuevo saldo
  const tasa = cuota.tasaInteresDiaria || 0.001;
  const interes = cuota.diasAtrasado > 0 ? Math.round(nuevoSaldo * tasa * cuota.diasAtrasado) : 0;
  const saldoTotal = nuevoSaldo + interes;

  // Actualizar
  const actualizada = await db.cuota.update({
    where: { id },
    data: {
      saldoGs: nuevoSaldo,
      interesGs: interes,
      saldoTotalGs: saldoTotal,
      montoEditado: true, // Marcar que el usuario editó el monto
    },
  });

  return ok({
    cuota: actualizada,
    mensaje: `Monto actualizado a ₲ ${new Intl.NumberFormat("es-PY").format(nuevoSaldo)} + ₲ ${new Intl.NumberFormat("es-PY").format(interes)} interés = ₲ ${new Intl.NumberFormat("es-PY").format(saldoTotal)}`,
  });
}
