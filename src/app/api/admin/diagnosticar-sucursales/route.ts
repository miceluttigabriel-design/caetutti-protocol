import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/diagnosticar-sucursales
 *
 * Diagnostica el estado de los datos por sucursal:
 *   1. Lista todas las sucursales con su ID
 *   2. Para cada sucursal, cuenta cuántos clientes y cuotas tienen ese sucursalId
 *   3. Cuenta cuántos clientes y cuotas tienen sucursalId = null
 *
 * POST /api/admin/diagnosticar-sucursales
 *   { arreglar: true }
 *
 * Repara los datos:
 *   1. Para cada cuota con sucursalId=null, toma el sucursalId del cliente (vía clienteId)
 *   2. Para cada cliente con sucursalId=null pero con cuotas que sí tienen sucursalId, copia de ahí
 *   3. Para los que siguen sin sucursalId, les asigna la sucursal "Principal"
 */
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  // 1. Listar todas las sucursales
  const sucursales = await db.sucursal.findMany({
    where: { empresaId: user.empresaId },
    select: { id: true, nombre: true, codigo: true },
    orderBy: { nombre: "asc" },
  });

  // 2. Para cada sucursal, contar clientes y cuotas
  const sucursalesStats = await Promise.all(
    sucursales.map(async (s) => {
      const [clientesCount, cuotasCount, cuotasPendientesCount] = await Promise.all([
        db.cliente.count({ where: { sucursalId: s.id } }),
        db.cuota.count({ where: { sucursalId: s.id } }),
        db.cuota.count({ where: { sucursalId: s.id, estado: "pendiente" } }),
      ]);
      return {
        id: s.id,
        nombre: s.nombre,
        codigo: s.codigo,
        clientes: clientesCount,
        cuotas: cuotasCount,
        cuotasPendientes: cuotasPendientesCount,
      };
    })
  );

  // 3. Contar registros con sucursalId = null
  const [clientesSinSucursal, cuotasSinSucursal, cuotasPendientesSinSucursal] = await Promise.all([
    db.cliente.count({ where: { empresaId: user.empresaId, sucursalId: null } }),
    db.cuota.count({ where: { empresaId: user.empresaId, sucursalId: null } }),
    db.cuota.count({ where: { empresaId: user.empresaId, sucursalId: null, estado: "pendiente" } }),
  ]);

  // 4. Para las cuotas con sucursalId=null, verificar si el cliente tiene sucursalId
  const cuotasSinSucursalConClienteConSucursal = await db.cuota.count({
    where: {
      empresaId: user.empresaId,
      sucursalId: null,
      cliente: { sucursalId: { not: null } },
    },
  });

  // 5. Resumen
  const totalClientes = await db.cliente.count({ where: { empresaId: user.empresaId } });
  const totalCuotas = await db.cuota.count({ where: { empresaId: user.empresaId } });

  const problemas: string[] = [];
  if (clientesSinSucursal > 0) {
    problemas.push(`❌ ${clientesSinSucursal} clientes sin sucursalId asignado`);
  }
  if (cuotasSinSucursal > 0) {
    problemas.push(`❌ ${cuotasSinSucursal} cuotas sin sucursalId asignado (de ${totalCuotas} totales)`);
  }
  if (cuotasSinSucursalConClienteConSucursal > 0) {
    problemas.push(`ℹ️ ${cuotasSinSucursalConClienteConSucursal} cuotas pueden repararse tomando el sucursalId del cliente`);
  }
  if (problemas.length === 0) {
    problemas.push("✅ Todo OK — todos los registros tienen sucursalId asignado");
  }

  return ok({
    sucursales: sucursalesStats,
    registrosSinSucursal: {
      clientesSinSucursal,
      cuotasSinSucursal,
      cuotasPendientesSinSucursal,
      cuotasReparablesPorCliente: cuotasSinSucursalConClienteConSucursal,
    },
    totales: {
      totalSucursales: sucursales.length,
      totalClientes,
      totalCuotas,
    },
    problemas,
  });
}

/**
 * POST /api/admin/diagnosticar-sucursales
 * Body: { arreglar: true }
 *
 * Repara los registros sin sucursalId:
 *   1. Para cada cuota con sucursalId=null, toma el sucursalId del cliente
 *   2. Para cada cliente con sucursalId=null pero con cuotas que sí tienen sucursalId, copia de ahí
 *   3. Para los que siguen sin sucursalId, les asigna la sucursal "Principal"
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

  if (!body.arreglar) {
    return fail("Pasá { arreglar: true } en el body para ejecutar la reparación");
  }

  const acciones: string[] = [];

  // Fase 1: Para cada cuota con sucursalId=null, tomar el sucursalId del cliente
  // Traer todas las cuotas con sucursalId=null y su cliente
  const cuotasSinSucursal = await db.cuota.findMany({
    where: {
      empresaId: user.empresaId,
      sucursalId: null,
    },
    select: {
      id: true,
      clienteId: true,
      cliente: { select: { sucursalId: true } },
    },
    take: 5000, // limit para no demorar
  });

  // Agrupar por sucursalId del cliente para hacer updateMany por lote
  const porSucursal = new Map<string, string[]>();
  let cuotasSinClienteSucursal = 0;

  for (const c of cuotasSinSucursal) {
    const sucId = c.cliente?.sucursalId;
    if (sucId) {
      if (!porSucursal.has(sucId)) porSucursal.set(sucId, []);
      porSucursal.get(sucId)!.push(c.id);
    } else {
      cuotasSinClienteSucursal++;
    }
  }

  let cuotasReparadasFase1 = 0;
  for (const [sucId, ids] of porSucursal.entries()) {
    const r = await db.cuota.updateMany({
      where: { id: { in: ids } },
      data: { sucursalId: sucId },
    });
    cuotasReparadasFase1 += r.count;
  }

  if (cuotasReparadasFase1 > 0) {
    acciones.push(`✅ Fase 1: ${cuotasReparadasFase1} cuotas reparadas tomando el sucursalId del cliente`);
  }

  // Fase 2: Para los clientes con sucursalId=null pero con cuotas que sí tienen sucursalId
  // Tomar el sucursalId de la primera cuota del cliente
  const clientesSinSucursal = await db.cliente.findMany({
    where: {
      empresaId: user.empresaId,
      sucursalId: null,
    },
    select: {
      id: true,
      cuotas: {
        where: { sucursalId: { not: null } },
        select: { sucursalId: true },
        take: 1,
      },
    },
    take: 5000,
  });

  let clientesReparadosFase2 = 0;
  const clientesSinNingunaSucursal: string[] = [];

  for (const c of clientesSinSucursal) {
    if (c.cuotas.length > 0 && c.cuotas[0].sucursalId) {
      await db.cliente.update({
        where: { id: c.id },
        data: { sucursalId: c.cuotas[0].sucursalId },
      });
      clientesReparadosFase2++;
    } else {
      clientesSinNingunaSucursal.push(c.id);
    }
  }

  if (clientesReparadosFase2 > 0) {
    acciones.push(`✅ Fase 2: ${clientesReparadosFase2} clientes reparados tomando el sucursalId de sus cuotas`);
  }

  // Fase 3: Para los que siguen sin sucursalId, asignarles la sucursal "Principal"
  let sucursalPrincipal = await db.sucursal.findFirst({
    where: { empresaId: user.empresaId, nombre: "Principal" },
  });
  if (!sucursalPrincipal) {
    sucursalPrincipal = await db.sucursal.create({
      data: { empresaId: user.empresaId, nombre: "Principal", codigo: "SUC-MAIN" },
    });
  }

  // Clientes sin sucursalId
  if (clientesSinNingunaSucursal.length > 0) {
    const r1 = await db.cliente.updateMany({
      where: { id: { in: clientesSinNingunaSucursal } },
      data: { sucursalId: sucursalPrincipal.id },
    });
    acciones.push(`✅ Fase 3: ${r1.count} clientes sin sucursal asignados a "Principal"`);
  }

  // Cuotas que todavía tienen sucursalId=null (no se repararon en fase 1)
  const cuotasAunSinSucursal = await db.cuota.updateMany({
    where: {
      empresaId: user.empresaId,
      sucursalId: null,
    },
    data: { sucursalId: sucursalPrincipal.id },
  });
  if (cuotasAunSinSucursal.count > 0) {
    acciones.push(`✅ Fase 3: ${cuotasAunSinSucursal.count} cuotas sin sucursal asignadas a "Principal"`);
  }

  if (acciones.length === 0) {
    acciones.push("✓ No se necesitó ninguna reparación — todos los registros ya tenían sucursalId");
  }

  return ok({
    mensaje: "Reparación completada",
    acciones,
  });
}
