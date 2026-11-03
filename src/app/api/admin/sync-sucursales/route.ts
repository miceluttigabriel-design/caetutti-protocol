import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/sync-sucursales
 *
 * Sincroniza el sucursalId de las cuotas con el sucursalId de su cliente.
 * Esto es necesario cuando las cuotas tienen sucursalId=null o un sucursalId
 * diferente al del cliente (por ejemplo, después de migraciones de sucursales).
 *
 * También sincroniza el sucursalId de los clientes con el de sus cuotas
 * (si el cliente tiene sucursalId=null pero sus cuotas tienen uno).
 *
 * Requiere permiso de admin.
 *
 * Body: { ejecutar?: true }  // sin esto, solo diagnostica
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
  const ejecutar = body.ejecutar === true;

  // ============================================================
  // FASE 1: Diagnóstico — traer TODAS las cuotas con su cliente
  // ============================================================
  const cuotas = await db.cuota.findMany({
    where: { empresaId: user.empresaId },
    select: {
      id: true,
      sucursalId: true,
      estado: true,
      clienteId: true,
      cliente: { select: { id: true, sucursalId: true, entidad: true } },
    },
    take: 10000, // límite de seguridad
  });

  // Estadísticas del diagnóstico
  const diagnostico = {
    totalCuotas: cuotas.length,
    cuotasConSucursalId: 0,
    cuotasSinSucursalId: 0,
    cuotasConSucursalIgualCliente: 0,
    cuotasConSucursalDiferenteCliente: 0,
    cuotasSinClienteSucursal: 0,
  };

  // Cuotas que necesitan sincronización
  const cuotasASincronizar: Array<{ id: string; nuevoSucursalId: string }> = [];

  for (const c of cuotas) {
    if (c.sucursalId) diagnostico.cuotasConSucursalId++;
    else diagnostico.cuotasSinSucursalId++;

    const sucursalCliente = c.cliente?.sucursalId;
    if (sucursalCliente) {
      if (c.sucursalId === sucursalCliente) {
        diagnostico.cuotasConSucursalIgualCliente++;
      } else {
        diagnostico.cuotasConSucursalDiferenteCliente++;
        if (ejecutar) {
          cuotasASincronizar.push({ id: c.id, nuevoSucursalId: sucursalCliente });
        }
      }
    } else {
      diagnostico.cuotasSinClienteSucursal++;
    }
  }

  // ============================================================
  // FASE 2: Diagnóstico de clientes
  // ============================================================
  const clientes = await db.cliente.findMany({
    where: { empresaId: user.empresaId },
    select: {
      id: true,
      sucursalId: true,
      entidad: true,
      cuotas: {
        where: { sucursalId: { not: null } },
        select: { sucursalId: true },
        take: 1,
      },
    },
    take: 10000,
  });

  const diagnosticoClientes = {
    totalClientes: clientes.length,
    clientesConSucursalId: 0,
    clientesSinSucursalId: 0,
    clientesReparables: 0,
  };

  const clientesASincronizar: Array<{ id: string; nuevoSucursalId: string }> = [];

  for (const c of clientes) {
    if (c.sucursalId) {
      diagnosticoClientes.clientesConSucursalId++;
    } else {
      diagnosticoClientes.clientesSinSucursalId++;
      if (c.cuotas.length > 0 && c.cuotas[0].sucursalId) {
        diagnosticoClientes.clientesReparables++;
        if (ejecutar) {
          clientesASincronizar.push({ id: c.id, nuevoSucursalId: c.cuotas[0].sucursalId! });
        }
      }
    }
  }

  // ============================================================
  // FASE 3: Ejecutar sincronización (si ejecutar=true)
  // ============================================================
  const acciones: string[] = [];

  if (ejecutar) {
    // Sincronizar cuotas: agrupar por nuevoSucursalId para hacer updateMany por lote
    const porSucursalCuotas = new Map<string, string[]>();
    for (const c of cuotasASincronizar) {
      if (!porSucursalCuotas.has(c.nuevoSucursalId)) porSucursalCuotas.set(c.nuevoSucursalId, []);
      porSucursalCuotas.get(c.nuevoSucursalId)!.push(c.id);
    }

    let cuotasActualizadas = 0;
    for (const [sucId, ids] of porSucursalCuotas.entries()) {
      const r = await db.cuota.updateMany({
        where: { id: { in: ids } },
        data: { sucursalId: sucId },
      });
      cuotasActualizadas += r.count;
    }

    if (cuotasActualizadas > 0) {
      acciones.push(`✅ ${cuotasActualizadas} cuotas sincronizadas con el sucursalId de su cliente`);
    }

    // Sincronizar clientes
    let clientesActualizados = 0;
    for (const c of clientesASincronizar) {
      await db.cliente.update({
        where: { id: c.id },
        data: { sucursalId: c.nuevoSucursalId },
      });
      clientesActualizados++;
    }

    if (clientesActualizados > 0) {
      acciones.push(`✅ ${clientesActualizados} clientes sincronizados con el sucursalId de sus cuotas`);
    }

    // Para los clientes que siguen sin sucursalId, asignar a "Principal"
    let sucursalPrincipal = await db.sucursal.findFirst({
      where: { empresaId: user.empresaId, nombre: "Principal" },
    });
    if (!sucursalPrincipal) {
      sucursalPrincipal = await db.sucursal.create({
        data: { empresaId: user.empresaId, nombre: "Principal", codigo: "SUC-MAIN" },
      });
    }

    // Clientes sin sucursal que no se pudieron reparar
    const clientesSinSucursalFinal = await db.cliente.findMany({
      where: { empresaId: user.empresaId, sucursalId: null },
      select: { id: true },
    });
    if (clientesSinSucursalFinal.length > 0) {
      const r = await db.cliente.updateMany({
        where: { id: { in: clientesSinSucursalFinal.map((c) => c.id) } },
        data: { sucursalId: sucursalPrincipal.id },
      });
      acciones.push(`✅ ${r.count} clientes sin sucursal asignados a "Principal"`);
    }

    // Cuotas sin sucursal que no se pudieron reparar (cliente tampoco tiene)
    const cuotasSinSucursalFinal = await db.cuota.updateMany({
      where: { empresaId: user.empresaId, sucursalId: null },
      data: { sucursalId: sucursalPrincipal.id },
    });
    if (cuotasSinSucursalFinal.count > 0) {
      acciones.push(`✅ ${cuotasSinSucursalFinal.count} cuotas sin sucursal asignadas a "Principal"`);
    }

    if (acciones.length === 0) {
      acciones.push("✓ No se necesitó sincronización — todo ya estaba alineado");
    }
  } else {
    acciones.push("ℹ️ Modo diagnóstico — pasá { ejecutar: true } para aplicar los cambios");
  }

  // ============================================================
  // FASE 4: Reporte por sucursal (después de la sincronización)
  // ============================================================
  const sucursales = await db.sucursal.findMany({
    where: { empresaId: user.empresaId },
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });

  const reporteSucursales = await Promise.all(
    sucursales.map(async (s) => {
      const [clientesCount, cuotasCount, cuotasPendientes] = await Promise.all([
        db.cliente.count({ where: { sucursalId: s.id } }),
        db.cuota.count({ where: { sucursalId: s.id } }),
        db.cuota.count({ where: { sucursalId: s.id, estado: "pendiente" } }),
      ]);
      return {
        id: s.id,
        nombre: s.nombre,
        clientes: clientesCount,
        cuotas: cuotasCount,
        cuotasPendientes,
      };
    })
  );

  return ok({
    mensaje: ejecutar
      ? "Sincronización completada — el dashboard por sucursal debería funcionar ahora"
      : "Diagnóstico completado (modo solo lectura)",
    diagnosticoCuotas: diagnostico,
    diagnosticoClientes,
    acciones,
    reporteSucursales,
  });
}

/**
 * GET /api/admin/sync-sucursales
 * Atajo: solo diagnostica (no aplica cambios)
 */
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  // Llamar a la lógica de POST con ejecutar=false
  return POST(req);
}
