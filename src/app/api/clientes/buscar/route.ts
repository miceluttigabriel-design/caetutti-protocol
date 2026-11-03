import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, unauthorized } from "@/lib/session";

/**
 * GET /api/clientes/buscar?q=texto
 * Búsqueda rápida de clientes para sugerir como codeudor.
 * Busca por: código, nombre, CI, teléfono.
 */
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (q.length < 2) return ok({ clientes: [] });

  const clientes = await db.cliente.findMany({
    where: {
      empresaId: user.empresaId,
      OR: [
        { codigoEntidad: { contains: q } },
        { entidad: { contains: q } },
        { ciEntidad: { contains: q } },
        { telefono: { contains: q } },
      ],
    },
    select: {
      id: true,
      codigoEntidad: true,
      entidad: true,
      ciEntidad: true,
      telefono: true,
      localidad: true,
    },
    take: 10,
    orderBy: { entidad: "asc" },
  });

  return ok({ clientes });
}
