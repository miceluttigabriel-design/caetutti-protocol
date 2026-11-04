import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";
import { generarMensajeAgrupado, generarMensajeCodeudor } from "@/lib/mensajes";

/**
 * POST /api/notificaciones/generar-mensaje
 * Genera el mensaje completo (cabecera + detalle×N + pie) sin enviarlo.
 * Sirve para previsualizar antes de enviar.
 *
 * Body: {
 *   modo: "cliente" | "codeudor",
 *   cliente: { id, entidad, codigoEntidad, ... cuotas: [...] }
 * }
 *
 * 🛠️ FIX CRÍTICO: recalcula `diasAtrasado` al vuelo para cada cuota, porque:
 *   1. El frontend puede mandar las cuotas sin el campo `diasAtrasado` (o con valor 0)
 *   2. El `maxDiasAtraso` que se usa para seleccionar el pie dinámico depende de esto
 *   3. Sin recalcular, el pie siempre sale "amable" (0-7 días) sin importar los días reales
 */
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const body = await req.json();
  const { modo, cliente } = body;

  if (!cliente) return fail("cliente requerido");

  // Si es cliente y tiene cuotas en el body, usar esas
  // Si no, cargar de BD
  let clienteData = cliente;
  let cuotasData = cliente.cuotas;

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
    cuotasData = c.cuotas;
  }

  if (!cuotasData || cuotasData.length === 0) {
    return ok({ mensaje: "Sin cuotas pendientes para notificar." });
  }

  // 🛠️ FIX CRÍTICO: Recalcular diasAtrasado al vuelo para cada cuota.
  // Sin esto, si el frontend manda diasAtrasado=0 o undefined, el pie siempre
  // sale "amable" (0-7 días) sin importar los días reales de atraso.
  const hoy = new Date();
  const hoyUtcMidnight = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate(), 0, 0, 0, 0);
  cuotasData = cuotasData.map((q: any) => {
    const vcto = new Date(q.fechaVcto);
    const vctoUtcMidnight = Date.UTC(vcto.getUTCFullYear(), vcto.getUTCMonth(), vcto.getUTCDate(), 0, 0, 0, 0);
    const diffMs = hoyUtcMidnight - vctoUtcMidnight;
    const diasCalculados = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    return {
      ...q,
      // Forzar el valor recalculado (sobreescribe lo que vino del frontend)
      diasAtrasado: diasCalculados,
    };
  });

  let mensaje: string;
  if (modo === "codeudor") {
    const nombreTitular = clienteData.entidad || clienteData.codeudor?.nombre || "el titular";
    const codeudorData = {
      entidad: nombreTitular,
      codigoEntidad: clienteData.codigoEntidad,
      telefono: clienteData.codeudor?.telefono || clienteData.codeudorTelefono || "",
      localidad: clienteData.localidad,
      sucursal: clienteData.sucursal,
      nombreCodeudor: clienteData.codeudor?.nombre || clienteData.codeudorNombre || "Codeudor",
      informconf: clienteData.informconf || "N",
    };
    mensaje = await generarMensajeCodeudor(user.empresaId, codeudorData, cuotasData);
  } else {
    mensaje = await generarMensajeAgrupado(user.empresaId, clienteData, cuotasData);
  }

  return ok({ mensaje });
}
