import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/cleanup-sucursales
 *
 * Body: { sucursales: ["CENTRAL ASUNCION", "SUCURSAL CAPIATA", ...] }
 *
 * Para cada sucursal:
 *   1. Busca la sucursal "Principal" (la crea si no existe)
 *   2. Reasigna todos los clientes y cuotas de la sucursal a borrar → "Principal"
 *   3. Borra la sucursal
 *
 * Requiere permiso de admin.
 */
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();
  if (user.rol !== "admin") {
    return fail("Solo el admin puede ejecutar esta acción", 403);
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const sucursalesABorrar: string[] = Array.isArray(body.sucursales)
    ? body.sucursales.map((s: any) => String(s).trim()).filter(Boolean)
    : [];

  if (sucursalesABorrar.length === 0) {
    return fail("Decime qué sucursales borrar: { sucursales: ['NOMBRE1', 'NOMBRE2'] }");
  }

  const resultados: Array<{
    nombre: string;
    encontrada: boolean;
    clientesMovidos: number;
    cuotasMovidas: number;
    borrada: boolean;
    error?: string;
  }> = [];

  // 1. Asegurar que existe la sucursal "Principal" (destino de los registros)
  let sucursalPrincipal = await db.sucursal.findFirst({
    where: { empresaId: user.empresaId, nombre: "Principal" },
  });

  if (!sucursalPrincipal) {
    sucursalPrincipal = await db.sucursal.create({
      data: {
        empresaId: user.empresaId,
        nombre: "Principal",
        codigo: "SUC-MAIN",
      },
    });
  }

  // 2. Para cada sucursal a borrar, reasignar y borrar
  for (const nombreSuc of sucursalesABorrar) {
    const resultado = {
      nombre: nombreSuc,
      encontrada: false,
      clientesMovidos: 0,
      cuotasMovidas: 0,
      borrada: false,
    };

    try {
      const suc = await db.sucursal.findFirst({
        where: {
          empresaId: user.empresaId,
          nombre: { equals: nombreSuc, mode: "insensitive" as const },
        },
      });

      if (!suc) {
        resultados.push(resultado);
        continue;
      }

      resultado.encontrada = true;

      // Mover clientes a "Principal"
      const clientesMovidos = await db.cliente.updateMany({
        where: { sucursalId: suc.id },
        data: { sucursalId: sucursalPrincipal.id },
      });
      resultado.clientesMovidos = clientesMovidos.count;

      // Mover cuotas a "Principal"
      const cuotasMovidas = await db.cuota.updateMany({
        where: { sucursalId: suc.id },
        data: { sucursalId: sucursalPrincipal.id },
      });
      resultado.cuotasMovidas = cuotasMovidas.count;

      // Mover ventasMes a "Principal" (o borrar si no se pueden mover)
      await db.ventaMes.updateMany({
        where: { sucursalId: suc.id },
        data: { sucursalId: sucursalPrincipal.id },
      }).catch(() => {});

      // Mover objetivos a "Principal"
      await db.objetivoDinamico.updateMany({
        where: { sucursalId: suc.id },
        data: { sucursalId: sucursalPrincipal.id },
      }).catch(() => {});

      // Finalmente, borrar la sucursal
      await db.sucursal.delete({ where: { id: suc.id } });
      resultado.borrada = true;

      resultados.push(resultado);
    } catch (e: any) {
      resultado.error = e.message || "Error desconocido";
      resultados.push(resultado);
    }
  }

  return ok({
    mensaje: "Limpieza de sucursales completada",
    sucursalDestino: "Principal",
    resultados,
  });
}
