import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";
import { ensurePromocionesTables } from "@/lib/promociones-db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET/POST /api/admin/setup-promociones
 * Crea (o verifica) las tablas del módulo de promociones.
 * Se puede abrir directo en el navegador estando logueado.
 */
async function setup() {
  const user = await getSession();
  if (!user) return unauthorized();

  try {
    await ensurePromocionesTables();

    const [campanas, contactos] = await Promise.all([
      db.promocion.count({ where: { empresaId: user.empresaId } }),
      db.promocionContacto.count({
        where: { promocion: { empresaId: user.empresaId } },
      }),
    ]);

    return ok({
      ok: true,
      mensaje: "Tablas de promociones listas",
      empresa: user.empresaNombre,
      conteos: { campanas, contactos },
    });
  } catch (e: any) {
    return fail(
      e?.message ||
        "No se pudieron crear las tablas. Revisá DATABASE_URL o corré npx prisma db push.",
      500
    );
  }
}

export async function GET() {
  return setup();
}

export async function POST() {
  return setup();
}
