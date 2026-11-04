import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";
import { generarMensajeAgrupado, generarMensajeCodeudor } from "@/lib/mensajes";

export const dynamic = "force-dynamic";

/**
 * POST /api/notificaciones/generar-mensaje
 * Genera el mensaje completo (cabecera + detalle×N + pie) sin enviarlo.
 *
 * FIX v3:
 *   - Recalcula diasAtrasado al vuelo (basado en fechaVcto vs hoy)
 *   - Asegura que las cuotas tengan el campo "diasAtrasado" (con "d")
 *     que es el que usa generarMensajeAgrupado/generarMensajeCodeudor
 *   - Esto hace que las reglas PIE se seleccionen correctamente según los días reales
 */
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const body = await req.json();
  const { modo, cliente } = body;

  if (!cliente) return fail("cliente requerido");

  // Si el frontend manda cuotas en el body, usarlas (ya vienen con diasAtraso recalculado)
  // Si no, cargar de BD y recalcular al vuelo
  let clienteData = cliente;
  let cuotasData: any[] = cliente.cuotas;

  if (!cuotasData && cliente.id) {
    const c = await db.cliente.findFirst({
      where: { id: cliente.id, empresaId: user.empresaId },
      include: {
        sucursal: { select: { nombre: true } },
        cuotas: {
          where: { estado: "pendiente" },
          orderBy: { fechaVcto: "asc" },
          include: { sucursal: { select: { nombre: true } } },
        },
      },
    });
    if (!c) return fail("Cliente no encontrado", 404);
    clienteData = c;
    cuotasData = c.cuotas as any[];
  }

  if (!cuotasData || cuotasData.length === 0) {
    return ok({ mensaje: "Sin cuotas pendientes para notificar." });
  }

  // === RECALCULAR diasAtrasado al vuelo ===
  // Asegura que cada cuota tenga el campo "diasAtrasado" (con "d") con el valor correcto.
  // Esto es lo que usa generarMensajeAgrupado para calcular maxDiasAtraso
  // y seleccionar la regla PIE correspondiente.
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  cuotasData = cuotasData.map((q: any) => {
    const vcto = new Date(q.fechaVcto);
    vcto.setHours(0, 0, 0, 0);
    const diffMs = hoy.getTime() - vcto.getTime();
    const diasCalculados = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

    // Asegurar que el campo se llame "diasAtrasado" (con "d") para que
    // generarMensajeAgrupado lo encuentre
    return {
      ...q,
      diasAtrasado: diasCalculados,
      // También actualizar el saldoTotalGs por si acaso
      saldoTotalGs: q.saldoTotalGs || q.saldoGs || 0,
    };
  });

  let mensaje: string;
  if (modo === "codeudor") {
    const codeudorData = {
      entidad: clienteData.codeudorNombre || "Codeudor",
      codigoEntidad: clienteData.codigoEntidad + " (codeudor)",
      telefono: clienteData.codeudorTelefono || "",
      localidad: clienteData.localidad,
      sucursal: clienteData.sucursal,
      // 🛠️ Pasamos informconf del TITULAR para que el mensaje del codeudor
      // también incluya el aviso INFORCONF si corresponde.
      informconf: clienteData.informconf || "N",
    };
    mensaje = await generarMensajeCodeudor(user.empresaId, codeudorData, cuotasData);
  } else {
    mensaje = await generarMensajeAgrupado(user.empresaId, clienteData, cuotasData);
  }

  // === DIAGNÓSTICO (para que veas qué regla se seleccionó) ===
  const maxDiasAtraso = Math.max(0, ...cuotasData.map((q: any) => q.diasAtrasado ?? 0));

  return ok({
    mensaje,
    _diagnostico: {
      maxDiasAtraso,
      cantidadCuotas: cuotasData.length,
      clienteEntidad: clienteData.entidad,
      modo,
    },
  });
}
