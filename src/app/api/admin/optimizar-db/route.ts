import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * ⚡ OPTIMIZAR BASE DE DATOS — ÍNDICES
 *
 * GET  /api/admin/optimizar-db            → diagnostica qué índices faltan (solo lectura)
 * POST /api/admin/optimizar-db            → crea los índices que falten
 *        body: { ejecutar: true }
 *
 * Los índices aceleran las consultas más pesadas del sistema:
 * saldos por cliente, filtro por sucursal, orden alfabético, notificaciones.
 * Son seguros: no tocan ningún dato, solo crean estructuras de búsqueda.
 */

const INDICES: Array<{ nombre: string; sql: string; utilidad: string }> = [
  {
    nombre: "Cuota_clienteId_estado_idx",
    sql: `CREATE INDEX IF NOT EXISTS "Cuota_clienteId_estado_idx" ON "Cuota"("clienteId", "estado")`,
    utilidad: "Saldos y cuotas pendientes por cliente (la más importante — Clientes, Notificaciones, Dashboard)",
  },
  {
    nombre: "Cliente_sucursalId_idx",
    sql: `CREATE INDEX IF NOT EXISTS "Cliente_sucursalId_idx" ON "Cliente"("sucursalId")`,
    utilidad: "Filtro de clientes por sucursal",
  },
  {
    nombre: "Cliente_entidad_idx",
    sql: `CREATE INDEX IF NOT EXISTS "Cliente_entidad_idx" ON "Cliente"("entidad")`,
    utilidad: "Orden alfabético de la lista de clientes",
  },
  {
    nombre: "Cuota_ultimaNotificacion_idx",
    sql: `CREATE INDEX IF NOT EXISTS "Cuota_ultimaNotificacion_idx" ON "Cuota"("ultimaNotificacion")`,
    utilidad: "Última notificación de cada cliente",
  },
  {
    nombre: "Cuota_notificado_idx",
    sql: `CREATE INDEX IF NOT EXISTS "Cuota_notificado_idx" ON "Cuota"("notificado")`,
    utilidad: "Estado notificado de las cuotas",
  },
];

export async function GET() {
  const user = await getSession();
  if (!user) return unauthorized();
  if (user.rol !== "admin") return fail("Solo el admin puede ejecutar esta acción", 403);

  const existentes = await db.$queryRawUnsafe<Array<{ indexname: string }>>(
    `SELECT indexname FROM pg_indexes WHERE tablename IN ('Cliente', 'Cuota')`
  );
  const nombres = new Set(existentes.map((e) => e.indexname));

  const [totalClientes, totalCuotas] = await Promise.all([
    db.cliente.count(),
    db.cuota.count(),
  ]);

  return ok({
    totalClientes,
    totalCuotas,
    indicesRequeridos: INDICES.map((i) => ({
      nombre: i.nombre,
      existe: nombres.has(i.nombre),
      utilidad: i.utilidad,
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();
  if (user.rol !== "admin") return fail("Solo el admin puede ejecutar esta acción", 403);

  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }
  if (!body.ejecutar) {
    return fail("Pasá { ejecutar: true } en el body para crear los índices");
  }

  const resultados: Array<{ nombre: string; listo: boolean; error?: string }> = [];
  for (const idx of INDICES) {
    try {
      await db.$executeRawUnsafe(idx.sql);
      resultados.push({ nombre: idx.nombre, listo: true });
    } catch (e: any) {
      resultados.push({ nombre: idx.nombre, listo: false, error: e.message || "Error" });
    }
  }

  const okTodos = resultados.every((r) => r.listo);

  return ok({
    mensaje: okTodos
      ? "✅ Índices listos — la carga de Clientes, Notificaciones y Dashboard será mucho más rápida"
      : "⚠️ Algunos índices no pudieron crearse (ver resultados)",
    resultados,
  });
}
