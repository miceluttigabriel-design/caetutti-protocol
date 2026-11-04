import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized, sucursalFilter } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET /api/notificaciones
// ?agrupada=true → lista TODOS los clientes con cuotas pendientes listas para notificar
// Sin param → lista historial de notificaciones enviadas
//
// CAMBIOS v3:
//   - Muestra TODOS los clientes (con o sin teléfono)
//   - Recalcula diasAtrasado al vuelo (basado en fechaVcto vs hoy)
//   - Ordena por diasAtrasado ascendente (menos vencido → más vencido)
//   - Actualiza la DB en background con los días recalculados (no bloquea)
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

  // Lista única de clientes con cuotas pendientes — sin filtro de teléfono
  const clientes = await db.cliente.findMany({
    where: {
      empresaId: user.empresaId,
      ...sucursalWhere,
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

  // === Recálculo al vuelo de diasAtrasado ===
  // Para cada cuota, calcular los días reales basados en fechaVcto vs hoy.
  // Esto asegura que el conteo sea correcto sin importar cuándo se importó.
  // 🛠️ Usamos componentes UTC en ambos lados para no tener off-by-one por zona
  //    horaria (las fechas de cuotas son "puras" — día/mes/año sin hora real).
  const ahora = new Date();
  const hoyY = ahora.getUTCFullYear();
  const hoyM = ahora.getUTCMonth();
  const hoyD = ahora.getUTCDate();
  const hoyUtcMidnight = Date.UTC(hoyY, hoyM, hoyD, 0, 0, 0, 0);

  // Track de cuotas que necesitan actualización en DB (en background)
  const cuotasAActualizar: Array<{ id: string; diasAtrasado: number }> = [];

  const resultado = clientes
    .map((c) => {
      // Mapear cuotas con diasAtrasado recalculado al vuelo
      const cuotasMapeadas = c.cuotas.map((q) => {
        const vcto = new Date(q.fechaVcto);
        const vctoUtcMidnight = Date.UTC(vcto.getUTCFullYear(), vcto.getUTCMonth(), vcto.getUTCDate(), 0, 0, 0, 0);
        const diffMs = hoyUtcMidnight - vctoUtcMidnight;
        const diasCalculados = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

        // Si el valor en DB es diferente, marcar para actualizar
        if (q.diasAtrasado !== diasCalculados) {
          cuotasAActualizar.push({ id: q.id, diasAtrasado: diasCalculados });
        }

        return {
          id: q.id,
          fechaVcto: q.fechaVcto,
          saldoGs: q.saldoGs,
          // 🛠️ FIX: no trabajamos con interés (no cuadra con el Excel).
          // El saldo total es IGUAL al saldo del Excel. Solo contamos días vencidos.
          saldoTotalGs: q.saldoGs,
          interesGs: 0,
          diasAtraso: diasCalculados, // ← valor recalculado al vuelo
          diasAtrasadoDB: q.diasAtrasado, // ← valor guardado (para comparar)
          descripcion: q.descripcion,
          notificado: q.notificado,
          ultimaNotificacion: q.ultimaNotificacion,
          montoEditado: q.montoEditado,
          interesManual: q.interesManual,
        };
      });

      // 🛠️ FIX: totalGs = suma de saldos del Excel (sin interés).
      const totalGs = cuotasMapeadas.reduce((s, q) => s + (q.saldoGs || 0), 0);
      const totalSaldoSinInteres = totalGs;
      const totalInteres = 0;
      const maxDiasAtraso = Math.max(0, ...cuotasMapeadas.map((q) => q.diasAtraso));
      const todasNotificadas = cuotasMapeadas.every((q) => q.notificado);
      if (ocultarNotificados && todasNotificadas) return null;

      // === ORDEN DE CUOTAS DENTRO DEL CLIENTE (igual que antes, aprobado) ===
      // 1º: las POR VENCER (fechaVcto >= hoy) — la más próxima primero
      // 2º: las VENCIDAS — la más recientemente vencida primero, la más antigua al final
      // 🛠️ Usamos UTC en ambos lados para no tener off-by-one por zona horaria.
      const tMidnight = (d: Date | string) => {
        const x = new Date(d);
        return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate(), 0, 0, 0, 0);
      };
      cuotasMapeadas.sort((x, y) => {
        const tx = tMidnight(x.fechaVcto);
        const ty = tMidnight(y.fechaVcto);
        const px = tx >= hoyUtcMidnight;
        const py = ty >= hoyUtcMidnight;
        if (px !== py) return px ? -1 : 1;
        return px ? tx - ty : ty - tx;
      });

      // === CRITERIO DE BLOQUE (corregido) ===
      // Si el cliente tiene AL MENOS UNA cuota vencida → va al bloque VENCIDOS
      //    y mostramos su fecha MÁS VENCIDA (la más antigua).
      // Si NO tiene ninguna vencida → va al bloque POR VENCER
      //    y mostramos su cuota por vencer MÁS PRÓXIMA.
      // Así ningún cliente vencido aparece mezclado en medio de los POR VENCER.
      const tieneVencidas = cuotasMapeadas.some((q) => tMidnight(q.fechaVcto) < hoyUtcMidnight);

      let proximaVcto: Date | null = null;
      let fechaMasVencida: Date | null = null;
      if (tieneVencidas) {
        fechaMasVencida =
          cuotasMapeadas
            .filter((q) => tMidnight(q.fechaVcto) < hoyUtcMidnight)
            .sort((a, b) => tMidnight(a.fechaVcto) - tMidnight(b.fechaVcto))[0]?.fechaVcto
            || null;
      } else {
        proximaVcto =
          cuotasMapeadas
            .slice()
            .sort((a, b) => tMidnight(a.fechaVcto) - tMidnight(b.fechaVcto))[0]?.fechaVcto
            || null;
      }

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
        proximaVcto,
        fechaMasVencida,
        totalGs,
        totalSaldoSinInteres,
        totalInteres,
        cantidadCuotas: cuotasMapeadas.length,
        maxDiasAtraso,
        todasNotificadas,
        // Última notificación del cliente (para mostrar cuándo fue la última vez)
        ultimaNotificacion: cuotasMapeadas.reduce((latest, q) => {
          if (!q.ultimaNotificacion) return latest;
          if (!latest) return q.ultimaNotificacion;
          return q.ultimaNotificacion > latest ? q.ultimaNotificacion : latest;
        }, null as Date | null),
        codeudor: c.codeudorNombre
          ? {
              nombre: c.codeudorNombre,
              telefono: c.codeudorTelefono,
              ci: c.codeudorCi,
              parentesco: c.codeudorParentesco,
            }
          : null,
        garantes: c.garantes || [],
        cuotas: cuotasMapeadas,
      };
    })
    .filter(Boolean)
    // === ORDENACIÓN DE LA LISTA DE CLIENTES ===
    // Bloques igual que antes: POR VENCER arriba, VENCIDOS abajo (aprobado, se conserva).
    // Dentro de cada bloque:
    //   ⭐ PRIMERO los clientes con informconf="S" (alerta INFORCONF优先)
    //   Después por fecha (mayor a menor en POR VENCER; menos → más vencido en VENCIDOS)
    .sort((a: any, b: any) => {
      const aInf = a.informconf === "S" ? 1 : 0;
      const bInf = b.informconf === "S" ? 1 : 0;
      // INFORCONF "S" primero dentro del bloque
      if (aInf !== bInf) return bInf - aInf;
      if (a.proximaVcto && b.proximaVcto) {
        return new Date(b.proximaVcto).getTime() - new Date(a.proximaVcto).getTime();
      }
      if (a.proximaVcto) return -1;
      if (b.proximaVcto) return 1;
      return a.maxDiasAtraso - b.maxDiasAtraso;
    });

  // === Actualización en background ===
  // Actualizar las cuotas en DB cuyos diasAtrasado cambiaron.
  // Se hace después del return para no bloquear la respuesta.
  // Limitado a 500 actualizaciones por request para no sobrecargar.
  if (cuotasAActualizar.length > 0) {
    const actualizaciones = cuotasAActualizar.slice(0, 500);
    Promise.all(
      actualizaciones.map(({ id, diasAtrasado }) =>
        db.cuota.update({
          where: { id },
          data: { diasAtrasado },
        }).catch(() => {})
      )
    ).catch(() => {
      // Silenciar errores en background
    });
  }

  return ok({ clientes: resultado });
}

// POST /api/notificaciones — registra envío de notificación
// Body: { clienteId, cuotaIds, telefono, mensaje, tipo, estado?, respuesta? }
//   estado: "enviada" (default) | "fallida"
//   respuesta: motivo del fallo (ej: "Número inválido", "Teléfono vacío")
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();
  const body = await req.json();
  const { clienteId, cuotaIds, telefono, mensaje, tipo, estado, respuesta } = body;
  if (!clienteId || !mensaje) {
    return fail("clienteId y mensaje son requeridos");
  }
  // Teléfono puede venir vacío (caso "Sin teléfono") → se registra como fallida
  const telefonoFinal = telefono || "";
  const estadoFinal = estado === "fallida" ? "fallida" : "enviada";

  const noti = await db.notificacion.create({
    data: {
      empresaId: user.empresaId,
      clienteId,
      telefono: telefonoFinal,
      mensaje,
      tipo: tipo || "individual",
      estado: estadoFinal,
      respuesta: estadoFinal === "fallida" ? (respuesta || "Fallida") : null,
      enviadoPor: user.id,
    },
  });

  // Solo marcar cuotas como notificadas si el envío fue exitoso
  if (estadoFinal === "enviada" && cuotaIds?.length) {
    await db.cuota.updateMany({
      where: { id: { in: cuotaIds } },
      data: { notificado: true, ultimaNotificacion: new Date() },
    });
  }

  // Solo registrar contacto del día si el envío fue exitoso
  if (estadoFinal === "enviada") {
    await db.contactoDia.create({
      data: {
        empresaId: user.empresaId,
        usuarioId: user.id,
        clienteId,
        telefono: telefonoFinal,
        tipo: "whatsapp",
      },
    });
  }

  return ok({ notificacion: noti });
}
