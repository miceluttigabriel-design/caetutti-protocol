import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, unauthorized } from "@/lib/session";
import { checkLimiteMensual, getOrCreateUsoMensual, META_COSTOS_PARAGUAY } from "@/lib/meta";

/**
 * GET /api/whatsapp/uso
 * Devuelve el uso del mes actual + límite configurado + histórico de meses anteriores.
 */
export async function GET() {
  const user = await getSession();
  if (!user) return unauthorized();

  const limite = await checkLimiteMensual(user.empresaId);
  const ahora = new Date();
  const mesActual = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}`;
  const usoActual = await getOrCreateUsoMensual(user.empresaId, mesActual);

  // Histórico (últimos 6 meses)
  const historico = await db.metaMensajeLog.findMany({
    where: {
      empresaId: user.empresaId,
      createdAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 180) },
    },
    select: { categoria: true, costoUsd: true, estado: true, createdAt: true },
  });

  // Agrupar por mes
  const porMes: Record<string, any> = {};
  for (const log of historico) {
    const mes = `${log.createdAt.getFullYear()}-${String(log.createdAt.getMonth() + 1).padStart(2, "0")}`;
    if (!porMes[mes]) {
      porMes[mes] = {
        mes,
        enviados: 0,
        costo: 0,
        fallidos: 0,
        UTILITY: 0,
        MARKETING: 0,
        SERVICE: 0,
        AUTHENTICATION: 0,
      };
    }
    porMes[mes].enviados++;
    porMes[mes].costo += log.costoUsd;
    if (log.estado === "fallido") porMes[mes].fallidos++;
    if (log.categoria in porMes[mes]) porMes[mes][log.categoria]++;
  }

  // Costos referenciales
  const costosRef = Object.entries(META_COSTOS_PARAGUAY).map(([k, v]) => ({
    categoria: k,
    costoUsd: v,
  }));

  return ok({
    actual: {
      mes: mesActual,
      enviadosUtility: usoActual.enviadosUtility,
      enviadosMarketing: usoActual.enviadosMarketing,
      enviadosService: usoActual.enviadosService,
      enviadosAuth: usoActual.enviadosAuth,
      recibidos: usoActual.recibidos,
      costoEstimadoUsd: limite.costoActual,
      bloqueado: limite.bloqueado,
    },
    limite: {
      mensualUsd: limite.limite,
      porcentajeUsado: limite.porcentaje,
      alertaEnPorcentaje: 80,
      bloquearAlLimite: true,
      restanteUsd: Math.max(0, limite.limite - limite.costoActual),
    },
    historico: Object.values(porMes).reverse(),
    costosReferencia: costosRef,
  });
}

/**
 * PUT /api/whatsapp/uso
 * Actualiza el límite mensual configurado.
 */
export async function PUT(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();
  if (user.rol !== "admin") return fail("Solo admin", 403);

  const body = await req.json();
  const { metaLimiteMensualUsd, metaAlertaPorcentaje, metaBloquearAlLimite } = body;

  const config = await db.configEmpresa.upsert({
    where: { empresaId: user.empresaId },
    update: {
      ...(metaLimiteMensualUsd !== undefined && { metaLimiteMensualUsd: Number(metaLimiteMensualUsd) }),
      ...(metaAlertaPorcentaje !== undefined && { metaAlertaPorcentaje: Number(metaAlertaPorcentaje) }),
      ...(metaBloquearAlLimite !== undefined && { metaBloquearAlLimite: !!metaBloquearAlLimite }),
    },
    create: { empresaId: user.empresaId },
  });

  // Si bajó el límite y estaba bloqueado, desbloquear el mes
  if (metaBloquearAlLimite === false) {
    const mesActual = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    await db.metaUsoMensual.updateMany({
      where: { empresaId: user.empresaId, anhoMes: mesActual },
      data: { bloqueado: false },
    });
  }

  return ok({ config });
}
