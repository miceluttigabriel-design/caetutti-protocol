import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized, sucursalFilter } from "@/lib/session";

// GET /api/notificaciones
// ?agrupada=true → lista clientes con cuotas pendientes listas para notificar
// Sin param → lista historial de notificaciones enviadas
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const sucursalId = searchParams.get("sucursal");
  const ocultarNotificados = searchParams.get("ocultar_notificados") === "true";

  const sucursalWhere =
    sucursalId && sucursalId !== "__TODAS__"
      ? { sucursalId }
      : sucursalFilter(user);

  // Lista única de clientes con cuotas pendientes
  // Cada cliente trae su codeudor registrado (si lo tiene)
  const clientes = await db.cliente.findMany({
    where: {
      empresaId: user.empresaId,
      ...sucursalWhere,
      telefono: { not: null },
      cuotas: {
        some: { estado: "pendiente" },
      },
    },
    include: {
      sucursal: { select: { nombre: true } },
      cuotas: {
        where: { estado: "pendiente" },
        orderBy: { fechaVcto: "asc" },
      },
      garantes: {
        where: { activo: true },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          garanteNombre: true,
          garanteTelefono: true,
          garanteCi: true,
          garanteParentesco: true,
        },
      },
    },
    orderBy: { entidad: "asc" },
  });

  const resultado = clientes
    .map((c) => {
      const totalGs = c.cuotas.reduce((s, q) => s + (q.saldoTotalGs || q.saldoGs), 0);
      const totalSaldoSinInteres = c.cuotas.reduce((s, q) => s + q.saldoGs, 0);
      const totalInteres = totalGs - totalSaldoSinInteres;
      const maxDiasAtraso = Math.max(0, ...c.cuotas.map((q) => q.diasAtrasado));
      const todasNotificadas = c.cuotas.every((q) => q.notificado);

      if (ocultarNotificados && todasNotificadas) return null;

      return {
        id: c.id,
        codigoEntidad: c.codigoEntidad,
        entidad: c.entidad,
        telefono: c.telefono,
        localidad: c.localidad,
        sucursal: c.sucursal?.nombre || "—",
        vendedor: c.vendedor,
        judicial: c.judicial,
        informconf: c.informconf,
        totalGs,
        totalSaldoSinInteres,
        totalInteres,
        cantidadCuotas: c.cuotas.length,
        maxDiasAtraso,
        todasNotificadas,
        // Última notificación del cliente (para mostrar cuándo fue la última vez)
        ultimaNotificacion: c.cuotas.reduce((latest, q) => {
          if (!q.ultimaNotificacion) return latest;
          if (!latest) return q.ultimaNotificacion;
          return q.ultimaNotificacion > latest ? q.ultimaNotificacion : latest;
        }, null as Date | null),
        // Datos del codeudor antiguo (campos en Cliente, compatibilidad)
        codeudor: c.codeudorNombre
          ? {
              nombre: c.codeudorNombre,
              telefono: c.codeudorTelefono,
              ci: c.codeudorCi,
              parentesco: c.codeudorParentesco,
            }
          : null,
        // Garantes múltiples (tabla separada Garante)
        garantes: c.garantes || [],
        cuotas: c.cuotas.map((q) => ({
          id: q.id,
          fechaVcto: q.fechaVcto,
          saldoGs: q.saldoGs,
          saldoTotalGs: q.saldoTotalGs || q.saldoGs,
          interesGs: q.interesGs || 0,
          diasAtrasado: q.diasAtrasado,
          descripcion: q.descripcion,
          notificado: q.notificado,
          ultimaNotificacion: q.ultimaNotificacion,
        })),
      };
    })
    .filter(Boolean)
    // Ordenar: menos vencido primero (maxDiasAtraso ascendente)
    .sort((a: any, b: any) => a.maxDiasAtraso - b.maxDiasAtraso);

  return ok({ clientes: resultado });
}

// POST /api/notificaciones — registra envío de notificación
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const body = await req.json();
  const { clienteId, cuotaIds, telefono, mensaje, tipo } = body;

  if (!clienteId || !telefono || !mensaje) {
    return fail("clienteId, telefono y mensaje son requeridos");
  }

  // En producción: aquí se llamaría a Evolution API para enviar el WhatsApp
  // Por ahora simulamos el envío registrando en la BD
  const noti = await db.notificacion.create({
    data: {
      empresaId: user.empresaId,
      clienteId,
      telefono,
      mensaje,
      tipo: tipo || "individual",
      estado: "enviada",
      enviadoPor: user.id,
    },
  });

  // Marca cuotas como notificadas
  if (cuotaIds?.length) {
    await db.cuota.updateMany({
      where: { id: { in: cuotaIds } },
      data: { notificado: true, ultimaNotificacion: new Date() },
    });
  }

  // Registra contacto del día
  await db.contactoDia.create({
    data: {
      empresaId: user.empresaId,
      usuarioId: user.id,
      clienteId,
      telefono,
      tipo: "whatsapp",
    },
  });

  return ok({ notificacion: noti });
}
