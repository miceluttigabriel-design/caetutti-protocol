import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";
import { ensurePromocionesTables } from "@/lib/promociones-db";
import { MODOS_ENVIO } from "@/lib/promociones";

export const dynamic = "force-dynamic";

/**
 * GET /api/promociones/[id] — campaña + una página de contactos.
 *
 * Query: ?estado=pendiente|enviado|error|omitido &q=texto &limit=100 &offset=0
 * Devuelve los contadores de todos los estados para que el panel no tenga que
 * cargar 70.000 contactos de una sola vez.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) return unauthorized();
  await ensurePromocionesTables();
  const { id } = await params;

  const { searchParams } = new URL(req.url);
  const estadoParam = searchParams.get("estado");
  const estado =
    estadoParam === "problemas"
      ? { in: ["error", "omitido"] }
      : ["pendiente", "enviado", "error", "omitido"].includes(estadoParam || "")
        ? (estadoParam as string)
        : undefined;
  const q = (searchParams.get("q") || "").trim();
  const limite = Math.min(Math.max(Number(searchParams.get("limit")) || 100, 1), 200);
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

  const promocion = await db.promocion.findFirst({
    where: { id, empresaId: user.empresaId },
    include: { sucursal: { select: { id: true, nombre: true } } },
  });
  if (!promocion) return fail("Campaña no encontrada", 404);

  const where: any = { promocionId: id };
  if (estado) where.estado = estado;
  if (q) {
    where.OR = [
      { nombre: { contains: q, mode: "insensitive" } },
      { telefono: { contains: q } },
      { modelo: { contains: q, mode: "insensitive" } },
      { localidad: { contains: q, mode: "insensitive" } },
    ];
  }

  const [contactos, totalFiltrado, grupos] = await Promise.all([
    db.promocionContacto.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: limite,
      skip: offset,
    }),
    db.promocionContacto.count({ where }),
    db.promocionContacto.groupBy({
      by: ["estado"],
      where: { promocionId: id },
      _count: { _all: true },
    }),
  ]);

  const totales = { pendiente: 0, enviado: 0, error: 0, omitido: 0, todos: 0 };
  for (const g of grupos) {
    const n = g._count._all;
    totales.todos += n;
    if (g.estado in totales) (totales as any)[g.estado] = n;
  }

  return ok({
    promocion,
    contactos,
    totalFiltrado,
    totales,
    limite,
    offset,
  });
}

/** PATCH /api/promociones/[id] — editar nombre, mensaje, modo o estado. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) return unauthorized();
  await ensurePromocionesTables();
  const { id } = await params;

  const actual = await db.promocion.findFirst({
    where: { id, empresaId: user.empresaId },
    select: { id: true },
  });
  if (!actual) return fail("Campaña no encontrada", 404);

  const body = await req.json().catch(() => ({}));
  const data: any = {};

  if (body.nombre !== undefined) {
    const nombre = String(body.nombre).trim();
    if (!nombre) return fail("El nombre no puede quedar vacío");
    data.nombre = nombre;
  }
  if (body.descripcion !== undefined) {
    data.descripcion = String(body.descripcion || "").trim() || null;
  }
  if (body.mensaje !== undefined) {
    const mensaje = String(body.mensaje).trim();
    if (!mensaje) return fail("El mensaje no puede quedar vacío");
    data.mensaje = mensaje;
  }
  if (body.modoEnvio !== undefined && MODOS_ENVIO.some((m) => m.key === body.modoEnvio)) {
    data.modoEnvio = body.modoEnvio;
  }
  if (body.estado !== undefined && ["borrador", "enviando", "finalizada"].includes(body.estado)) {
    data.estado = body.estado;
  }

  const promocion = await db.promocion.update({ where: { id }, data });
  return ok({ promocion });
}

/** DELETE /api/promociones/[id] — borra la campaña y sus contactos. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) return unauthorized();
  await ensurePromocionesTables();
  const { id } = await params;

  const actual = await db.promocion.findFirst({
    where: { id, empresaId: user.empresaId },
    select: { id: true },
  });
  if (!actual) return fail("Campaña no encontrada", 404);

  await db.promocion.delete({ where: { id } });
  return ok({ success: true });
}
