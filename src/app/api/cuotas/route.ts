import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized, sucursalFilter } from "@/lib/session";
import { recalcularInteresPorFecha } from "@/lib/interes";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const estado = searchParams.get("estado"); // pendiente | cobrada
  const clienteId = searchParams.get("cliente_id");
  const soloPendientes = searchParams.get("solo_pendientes") === "true";

  const where: any = {
    empresaId: user.empresaId,
    ...sucursalFilter(user),
  };
  if (estado) where.estado = estado;
  if (clienteId) where.clienteId = clienteId;
  if (soloPendientes) where.estado = "pendiente";

  const cuotas = await db.cuota.findMany({
    where,
    include: {
      cliente: { select: { codigoEntidad: true, entidad: true, telefono: true, localidad: true } },
      sucursal: { select: { nombre: true } },
      codeudor: { select: { codigoEntidad: true, entidad: true } },
    },
    orderBy: { fechaVcto: "asc" },
  });

  return ok({ cuotas });
}

export async function PATCH(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const body = await req.json();
  const { id, estado, saldoGs, saldoGuarani, saldoDolar, fechaVcto, descripcion, vendedor, interesGs } = body;
  if (!id) return fail("id es requerido");

  // Caso 1: solo cambiar estado (cobrada/pendiente/anulada)
  if (estado && saldoGs === undefined && saldoGuarani === undefined && saldoDolar === undefined && !fechaVcto && interesGs === undefined) {
    const cuota = await db.cuota.update({
      where: { id, empresaId: user.empresaId },
      data: { estado },
    });
    return ok({ cuota });
  }

  // Caso 2: editar montos y/o fecha y/o interés (marca montoEditado=true)
  const data: any = { montoEditado: true };
  if (saldoGs !== undefined) data.saldoGs = Number(saldoGs);
  if (saldoGuarani !== undefined) data.saldoGuarani = Number(saldoGuarani);
  if (saldoDolar !== undefined) data.saldoDolar = Number(saldoDolar);
  if (fechaVcto) data.fechaVcto = new Date(fechaVcto);
  if (descripcion !== undefined) data.descripcion = descripcion;
  if (vendedor !== undefined) data.vendedor = vendedor;
  if (estado) data.estado = estado;

  // === Manejo del interés ===
  // Si el usuario editó el interés manualmente → marcar interesManual=true y usar ese valor
  // Si el usuario NO editó el interés → recalcular automáticamente según la lógica diaria
  const cuotaActual = await db.cuota.findUnique({ where: { id, empresaId: user.empresaId } });
  if (cuotaActual) {
    const saldoFinal = saldoGs !== undefined ? Number(saldoGs) : cuotaActual.saldoGs;
    const fechaFinal = fechaVcto ? new Date(fechaVcto) : cuotaActual.fechaVcto;

    // Recalcular días de atraso SIEMPRE (cambia diariamente)
    const { recalcularInteresPorFecha } = await import("@/lib/interes");
    const recalc = recalcularInteresPorFecha(saldoFinal, fechaFinal, cuotaActual.tasaInteresDiaria);
    data.diasAtrasado = recalc.diasAtrasado;

    if (interesGs !== undefined) {
      // === El usuario editó el interés manualmente ===
      data.interesGs = Number(interesGs);
      data.interesManual = true;
      data.saldoTotalGs = saldoFinal + Number(interesGs);
    } else if (cuotaActual.interesManual) {
      // === La cuota ya tenía interesManual=true y el usuario no lo cambió ===
      // Mantener el interés manual, solo actualizar saldoTotalGs con el saldo actual
      data.interesGs = cuotaActual.interesGs;
      data.saldoTotalGs = saldoFinal + cuotaActual.interesGs;
    } else {
      // === Calcular interés automáticamente según la lógica diaria ===
      data.interesGs = recalc.interesGs;
      data.saldoTotalGs = recalc.saldoTotalGs;
    }
  }

  const cuota = await db.cuota.update({
    where: { id, empresaId: user.empresaId },
    data,
  });
  return ok({
    cuota,
    msg: "Cuota actualizada. Interés y días recalculados automáticamente (o respetado si fue manual).",
    recalculo: {
      saldoGs: cuota.saldoGs,
      interesGs: cuota.interesGs,
      saldoTotalGs: cuota.saldoTotalGs,
      diasAtrasado: cuota.diasAtrasado,
      interesManual: cuota.interesManual,
    },
  });
}
