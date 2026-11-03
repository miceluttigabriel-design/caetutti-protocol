import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, unauthorized } from "@/lib/session";

/**
 * GET /api/contactos-dia
 * Lista personas contactadas hoy, agrupadas por usuario.
 */
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const fecha = searchParams.get("fecha"); // YYYY-MM-DD

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const manana = new Date(hoy);
  manana.setDate(manana.getDate() + 1);

  const fechaDesde = fecha ? new Date(fecha) : hoy;
  const fechaHasta = fecha ? new Date(new Date(fecha).getTime() + 86400000) : manana;

  const contactos = await db.contactoDia.findMany({
    where: {
      empresaId: user.empresaId,
      fecha: { gte: fechaDesde, lt: fechaHasta },
    },
    include: {
      usuario: { select: { nombre: true, login: true } },
      cliente: { select: { codigoEntidad: true, entidad: true } },
    },
    orderBy: { fecha: "desc" },
  });

  // Agrupar por usuario
  const porUsuario: Record<string, any> = {};
  for (const c of contactos) {
    const uid = c.usuarioId;
    if (!porUsuario[uid]) {
      porUsuario[uid] = {
        usuario: c.usuario,
        total: 0,
        contactos: [],
      };
    }
    porUsuario[uid].total++;
    porUsuario[uid].contactos.push(c);
  }

  return ok({
    total: contactos.length,
    porUsuario: Object.values(porUsuario),
    fecha: fechaDesde.toISOString().slice(0, 10),
  });
}
