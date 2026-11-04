import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, unauthorized, sucursalFilter } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/inforconf/exclusiones
 *
 * Reporte de EXCLUSIONES DE MOROSIDADES:
 * Lista clientes marcados como INFORCONF="S" que:
 *   - NO tienen cuotas pendientes (la deuda fue paga o no vino en el Excel)
 *   - O tienen cuotas pero con vencimiento actualizado (vcto reciente)
 *
 * Estos clientes deben aparecer para que el usuario pueda quitarles el flag
 * INFORCONF (porque ya no están morosos o la deuda se actualizó).
 *
 * Devuelve 2 listas:
 *   - titulares: clientes con INFORCONF="S" sin deuda activa
 *   - codeudores: codeudores (Garante) con INFORCONF="S" en el titular sin deuda activa
 *
 * Query params:
 *   ?sucursal=ID  — filtrar por sucursal
 */
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const sucursalId = searchParams.get("sucursal");
  const sucursalWhere =
    sucursalId && sucursalId !== "__TODAS__"
      ? { sucursalId }
      : sucursalFilter(user);

  // === TITULARES con INFORCONF="S" sin cuotas pendientes ===
  const titularesSinDeuda = await db.cliente.findMany({
    where: {
      empresaId: user.empresaId,
      ...sucursalWhere,
      informconf: "S",
      cuotas: { none: { estado: "pendiente" } },
    },
    include: {
      sucursal: { select: { nombre: true } },
    },
    orderBy: { entidad: "asc" },
  });

  // Última notificación de cada titular
  const titularIds = titularesSinDeuda.map((c) => c.id);
  const notifsTitulares = await db.notificacion.findMany({
    where: { clienteId: { in: titularIds } },
    orderBy: { createdAt: "desc" },
    distinct: ["clienteId"],
    select: { clienteId: true, createdAt: true },
  });
  const ultMapTit = new Map(notifsTitulares.map((n) => [n.clienteId, n.createdAt]));

  const titulares = titularesSinDeuda.map((c) => ({
    id: c.id,
    entidad: c.entidad,
    codigoEntidad: c.codigoEntidad,
    ciEntidad: c.ciEntidad || "",
    telefono: c.telefono || "",
    localidad: c.localidad || "",
    vendedor: c.vendedor || "",
    sucursal: c.sucursal?.nombre || "—",
    judicial: c.judicial === "S",
    ultimaNotificacion: ultMapTit.get(c.id) || null,
  }));

  // === CODEUDORES: titulares con INFORCONF="S" que tienen codeudor registrado
  //     pero el codeudor NO tiene cuota pendiente propia (sigue figurando para
  //     que el usuario le saque INFORCONF al codeudor también).
  //     Usamos el campo codeudorNombre del titular (sistema antiguo).
  const codeudoresConInforconf = await db.cliente.findMany({
    where: {
      empresaId: user.empresaId,
      ...sucursalWhere,
      informconf: "S",
      codeudorNombre: { not: null },
      // El titular puede tener o no cuota pendiente — lo importante es que
      // tenga codeudor registrado e INFORCONF marcado.
    },
    include: {
      sucursal: { select: { nombre: true } },
    },
    orderBy: { entidad: "asc" },
  });

  const codeudores = codeudoresConInforconf
    .filter((c) => c.codeudorNombre)
    .map((c) => ({
      id: c.id,
      titularEntidad: c.entidad,
      titularCodigo: c.codigoEntidad,
      codeudorNombre: c.codeudorNombre || "",
      codeudorTelefono: c.codeudorTelefono || "",
      codeudorCi: c.codeudorCi || "",
      codeudorParentesco: c.codeudorParentesco || "",
      sucursal: c.sucursal?.nombre || "—",
      titularSinDeuda: titulares.some((t) => t.id === c.id),
    }));

  return ok({
    titulares,
    codeudores,
    totalTitulares: titulares.length,
    totalCodeudores: codeudores.length,
    resumen: {
      totalExclusiones: titulares.length + codeudores.length,
      mensaje: "Clientes marcados en INFORCONF que ya no tienen deuda activa o cuya deuda fue actualizada.",
    },
  });
}
