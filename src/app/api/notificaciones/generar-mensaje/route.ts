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

  let mensaje: string;
  if (modo === "codeudor") {
    // Para codeudor: usar los datos del codeudor registrado en el cliente
    const codeudorData = {
      entidad: clienteData.codeudorNombre || "Codeudor",
      codigoEntidad: clienteData.codigoEntidad + " (codeudor)",
      telefono: clienteData.codeudorTelefono || "",
      localidad: clienteData.localidad,
      sucursal: clienteData.sucursal,
    };
    mensaje = await generarMensajeCodeudor(user.empresaId, codeudorData, cuotasData);
  } else {
    mensaje = await generarMensajeAgrupado(user.empresaId, clienteData, cuotasData);
  }

  return ok({ mensaje });
}
