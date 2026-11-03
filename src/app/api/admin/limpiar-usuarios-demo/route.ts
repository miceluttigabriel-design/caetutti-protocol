import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/limpiar-usuarios-demo
 *
 * Elimina los usuarios demo (cobrador y vendedor) de la base de datos.
 * Solo deja el usuario admin.
 *
 * Requiere permiso de admin.
 *
 * Body (opcional):
 *   { confirmar: true }  // requerido para ejecutar
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

  if (!body.confirmar) {
    return fail("Pasá { confirmar: true } en el body para ejecutar la eliminación");
  }

  // Buscar los usuarios demo
  const usuariosDemo = await db.usuario.findMany({
    where: {
      empresaId: user.empresaId,
      login: { in: ["cobrador", "vendedor"] },
    },
    select: { id: true, login: true, nombre: true, rol: true },
  });

  const resultados: Array<{ login: string; nombre: string; eliminado: boolean; error?: string }> = [];

  for (const u of usuariosDemo) {
    try {
      // Eliminar registros relacionados primero (por las foreign keys)
      // Notificaciones enviadas por este usuario
      await db.notificacion.deleteMany({ where: { enviadoPor: u.id } }).catch(() => {});
      // Contactos del día registrados por este usuario
      await db.contactoDia.deleteMany({ where: { usuarioId: u.id } }).catch(() => {});

      // Ahora eliminar el usuario
      await db.usuario.delete({ where: { id: u.id } });

      resultados.push({
        login: u.login,
        nombre: u.nombre,
        eliminado: true,
      });
    } catch (e: any) {
      resultados.push({
        login: u.login,
        nombre: u.nombre,
        eliminado: false,
        error: e.message || "Error desconocido",
      });
    }
  }

  // Listar usuarios restantes
  const usuariosRestantes = await db.usuario.findMany({
    where: { empresaId: user.empresaId },
    select: { id: true, login: true, nombre: true, rol: true, activo: true },
    orderBy: { login: "asc" },
  });

  return ok({
    mensaje: "Limpieza de usuarios demo completada",
    eliminados: resultados,
    usuariosRestantes,
  });
}

/**
 * GET /api/admin/limpiar-usuarios-demo
 * Lista los usuarios demo existentes (sin eliminar nada) para previsualizar
 */
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const usuariosDemo = await db.usuario.findMany({
    where: {
      empresaId: user.empresaId,
      login: { in: ["cobrador", "vendedor"] },
    },
    select: { id: true, login: true, nombre: true, rol: true, activo: true, createdAt: true },
  });

  const usuariosTotales = await db.usuario.findMany({
    where: { empresaId: user.empresaId },
    select: { id: true, login: true, nombre: true, rol: true, activo: true },
    orderBy: { login: "asc" },
  });

  return ok({
    usuariosDemoEncontrados: usuariosDemo.length,
    usuariosDemo,
    usuariosTotales,
  });
}
