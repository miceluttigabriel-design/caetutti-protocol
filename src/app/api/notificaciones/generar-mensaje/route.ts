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
    // Para codeudor: el mensaje va dirigido al codeudor, pero {Entidad} en la
    // cabecera debe ser el NOMBRE DEL TITULAR (el cliente que debe), no "Codeudor".
    // El nombre del codeudor se pasa en "nombreCodeudor" para que el template
    // pueda usarlo si quiere (variable {Nombre Codeudor}).
    const nombreTitular = clienteData.entidad || clienteData.codeudor?.nombre || "el titular";
    const codeudorData = {
      entidad: nombreTitular,           // ← {Entidad} = nombre del TITULAR
      codigoEntidad: clienteData.codigoEntidad,
      telefono: clienteData.codeudor?.telefono || clienteData.codeudorTelefono || "",
      localidad: clienteData.localidad,
      sucursal: clienteData.sucursal,
      // Info del codeudor (para variable {Nombre Codeudor} en plantillas)
      nombreCodeudor: clienteData.codeudor?.nombre || clienteData.codeudorNombre || "Codeudor",
      informconf: clienteData.informconf || "N",
    };
    mensaje = await generarMensajeCodeudor(user.empresaId, codeudorData, cuotasData);
  } else {
    mensaje = await generarMensajeAgrupado(user.empresaId, clienteData, cuotasData);
  }

  return ok({ mensaje });
}
