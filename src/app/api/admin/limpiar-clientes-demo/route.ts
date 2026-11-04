import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/limpiar-clientes-demo
 *   → Lista los clientes demo que serían eliminados (MODO PREVIEW, no borra nada).
 *
 * POST /api/admin/limpiar-clientes-demo
 *   Body: { confirmar: true }
 *   → Elimina los clientes demo de la base de datos.
 *
 * Criterio para considerar un cliente "demo/ficticio":
 *   1. codigoEntidad empieza con "CLI" y después son solo dígitos (patrón /^CLI\d+$/).
 *      Los reales vienen del Excel con códigos como 057050, 110324, 300164, etc.
 *   2. NO tiene ninguna cuota (pendiente ni cobrada) — para no borrar historial.
 *   3. NO tiene notificaciones enviadas — para no borrar historial.
 *
 * Esto es SEGURO: si un cliente CLI0000X llegó a tener cuotas o notificaciones,
 * NO se borra (queda en la lista "protegidos").
 *
 * Solo el admin puede ejecutarlo.
 */

// Regex para identificar códigos demo: CLI seguido de dígitos
const RE_DEMO = /^CLI\d+$/;

async function obtenerCandidatos(empresaId: string) {
  // Prisma no soporta regex: traemos todos los que empiezan con "CLI" y filtramos en JS
  const todos = await db.cliente.findMany({
    where: {
      empresaId,
      codigoEntidad: { startsWith: "CLI" },
    },
    include: {
      sucursal: { select: { nombre: true } },
      cuotas: { select: { id: true }, take: 1 },
      notificaciones: { select: { id: true }, take: 1 },
      garantes: { select: { id: true }, take: 1 },
    },
    orderBy: { codigoEntidad: "asc" },
  });

  // Filtrar los que cumplen el patrón exacto CLI+dígitos
  const candidatos = todos.filter((c) => RE_DEMO.test(c.codigoEntidad));

  // Separar en "a borrar" (sin cuotas/notif) y "protegidos" (con historial)
  const aBorrar = candidatos.filter(
    (c) => c.cuotas.length === 0 && c.notificaciones.length === 0
  );
  const protegidos = candidatos.filter(
    (c) => c.cuotas.length > 0 || c.notificaciones.length > 0
  );

  return { aBorrar, protegidos };
}

export async function GET() {
  const user = await getSession();
  if (!user) return unauthorized();
  if (user.rol !== "admin") return fail("Solo el admin", 403);

  const { aBorrar, protegidos } = await obtenerCandidatos(user.empresaId);

  return ok({
    totalCandidatos: aBorrar.length + protegidos.length,
    aBorrar: aBorrar.length,
    protegidos: protegidos.length,
    previewBorrado: aBorrar.map((c) => ({
      id: c.id,
      codigoEntidad: c.codigoEntidad,
      entidad: c.entidad,
      telefono: c.telefono || "—",
      localidad: c.localidad || "—",
      sucursal: c.sucursal?.nombre || "—",
    })),
    previewProtegidos: protegidos.map((c) => ({
      id: c.id,
      codigoEntidad: c.codigoEntidad,
      entidad: c.entidad,
      motivo: `Tiene ${c.cuotas.length > 0 ? "cuotas" : ""} ${c.notificaciones.length > 0 ? "y notificaciones" : ""}`.trim(),
    })),
    mensaje:
      aBorrar.length === 0
        ? "No hay clientes demo para borrar."
        : `Se eliminarían ${aBorrar.length} cliente(s) demo. Ejecutá POST con { confirmar: true } para borrar.`,
  });
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();
  if (user.rol !== "admin") return fail("Solo el admin", 403);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (!body.confirmar) {
    return fail("Pasá { confirmar: true } en el body para ejecutar la eliminación");
  }

  const { aBorrar } = await obtenerCandidatos(user.empresaId);

  if (aBorrar.length === 0) {
    return ok({
      mensaje: "No hay clientes demo para borrar.",
      borrados: 0,
    });
  }

  const idsBorrar = aBorrar.map((c) => c.id);

  // Borrar garantes del cliente primero (relación) — si los hubiera.
  // Aunque el filtro ya garantiza que no tienen cuotas/notif, podrían tener garantes.
  await db.garante.deleteMany({
    where: { clienteId: { in: idsBorrar } },
  }).catch(() => {});

  // Borrar los clientes demo
  const result = await db.cliente.deleteMany({
    where: { id: { in: idsBorrar } },
  });

  return ok({
    mensaje: `Se eliminaron ${result.count} cliente(s) demo del sistema.`,
    borrados: result.count,
    codigosBorrados: aBorrar.map((c) => c.codigoEntidad),
  });
}
