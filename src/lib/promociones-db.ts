import { db } from "@/lib/db";

/**
 * Auto-provisión del módulo de Promociones.
 *
 * Crea las dos tablas nuevas si todavía no existen. Es idempotente y aditivo:
 * no toca clientes, cuotas, notificaciones ni ninguna tabla existente.
 *
 * Si preferís el camino canónico, `npx prisma db push` crea exactamente las
 * mismas tablas y estas sentencias quedan como no-op.
 */

const STMTS: string[] = [
  `CREATE TABLE IF NOT EXISTS "Promocion" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "sucursalId" TEXT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "mensaje" TEXT NOT NULL,
    "modoEnvio" TEXT NOT NULL DEFAULT 'manual',
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "totalContactos" INTEGER NOT NULL DEFAULT 0,
    "enviados" INTEGER NOT NULL DEFAULT 0,
    "errores" INTEGER NOT NULL DEFAULT 0,
    "creadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Promocion_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "PromocionContacto" (
    "id" TEXT NOT NULL,
    "promocionId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "telefonoNormalizado" TEXT,
    "modelo" TEXT,
    "localidad" TEXT,
    "ci" TEXT,
    "notas" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "errorDetalle" TEXT,
    "enviadoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromocionContacto_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "Promocion_empresaId_createdAt_idx" ON "Promocion"("empresaId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "PromocionContacto_promocionId_estado_idx" ON "PromocionContacto"("promocionId", "estado")`,
  `CREATE INDEX IF NOT EXISTS "PromocionContacto_telefono_idx" ON "PromocionContacto"("telefono")`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Promocion_empresaId_fkey') THEN ALTER TABLE "Promocion" ADD CONSTRAINT "Promocion_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Promocion_sucursalId_fkey') THEN ALTER TABLE "Promocion" ADD CONSTRAINT "Promocion_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromocionContacto_promocionId_fkey') THEN ALTER TABLE "PromocionContacto" ADD CONSTRAINT "PromocionContacto_promocionId_fkey" FOREIGN KEY ("promocionId") REFERENCES "Promocion"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`,
];

let ensurePromise: Promise<void> | null = null;

// Si dos instancias arrancan al mismo tiempo, PostgreSQL puede devolver
// "already exists" aunque la sentencia tenga IF NOT EXISTS. No es un error real.
const CODIGOS_IGNORABLES = new Set([
  "42P07", // duplicate_table
  "42710", // duplicate_object
  "23505", // unique_violation (carrera en pg_type/pg_constraint)
]);

export function ensurePromocionesTables(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      for (const stmt of STMTS) {
        try {
          await db.$executeRawUnsafe(stmt);
        } catch (error: any) {
          if (!CODIGOS_IGNORABLES.has(String(error?.code || ""))) throw error;
        }
      }
    })().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }
  return ensurePromise;
}

export interface ContactoParaInsertar {
  nombre: string;
  telefono: string;
  telefonoNormalizado: string | null;
  modelo: string | null;
  localidad: string | null;
  ci: string | null;
  notas: string | null;
}

const MAX_LOTE = 3000;

function texto(v: unknown, max = 500): string | null {
  const t = String(v ?? "").trim();
  return t ? t.slice(0, max) : null;
}

/**
 * Toma el array que manda el navegador (el Excel se lee allá) y lo deja
 * listo para insertar. No confía en el estado ni en el teléfono normalizado:
 * los vuelve a validar acá.
 */
export function normalizarContactosEntrantes(entrantes: unknown): ContactoParaInsertar[] {
  if (!Array.isArray(entrantes)) return [];

  return entrantes.slice(0, MAX_LOTE).map((c: any) => {
    const telefono = String(c?.telefono ?? "").trim().slice(0, 40);
    const normalizado = c?.telefonoNormalizado ? String(c.telefonoNormalizado) : "";
    return {
      nombre: String(c?.nombre ?? "").trim().slice(0, 200) || "Sin nombre",
      telefono,
      telefonoNormalizado: /^595\d{9}$/.test(normalizado) ? normalizado : null,
      modelo: texto(c?.modelo, 200),
      localidad: texto(c?.localidad, 200),
      ci: texto(c?.ci, 50),
      notas: texto(c?.notas, 500),
    };
  });
}

/**
 * Inserta los contactos en lotes de 500. Un Excel grande (100.000 filas) no
 * entra en un solo INSERT: PostgreSQL tiene un límite de parámetros por query.
 */
export async function insertarContactosEnLotes(
  promocionId: string,
  filas: ContactoParaInsertar[]
): Promise<number> {
  const LOTE = 500;
  let insertados = 0;

  for (let i = 0; i < filas.length; i += LOTE) {
    const lote = filas.slice(i, i + LOTE);
    await db.promocionContacto.createMany({
      data: lote.map((f) => ({
        promocionId,
        nombre: f.nombre,
        telefono: f.telefono,
        telefonoNormalizado: f.telefonoNormalizado,
        modelo: f.modelo,
        localidad: f.localidad,
        ci: f.ci,
        notas: f.notas,
        estado: f.telefonoNormalizado ? "pendiente" : "omitido",
        errorDetalle: f.telefonoNormalizado ? null : "No es un celular paraguayo",
      })),
    });
    insertados += lote.length;
  }

  return insertados;
}
