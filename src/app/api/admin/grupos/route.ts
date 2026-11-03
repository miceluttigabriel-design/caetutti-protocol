import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, unauthorized } from "@/lib/session";

export async function GET() {
  const user = await getSession();
  if (!user) return unauthorized();
  if (user.rol !== "admin") {
    return Response.json({ error: "Solo admin" }, { status: 403 });
  }

  const grupos = await db.grupo.findMany({
    where: { empresaId: user.empresaId },
    include: { _count: { select: { usuarios: true } } },
    orderBy: { nombre: "asc" },
  });

  const sucursales = await db.sucursal.findMany({
    where: { empresaId: user.empresaId },
    select: { id: true, nombre: true, codigo: true },
  });

  return ok({ grupos, sucursales });
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();
  if (user.rol !== "admin") {
    return Response.json({ error: "Solo admin" }, { status: 403 });
  }

  const body = await req.json();
  const { nombre, descripcion, permisos, esAdmin } = body;

  if (!nombre) {
    return Response.json({ error: "nombre requerido" }, { status: 400 });
  }

  const g = await db.grupo.create({
    data: {
      nombre,
      descripcion: descripcion || null,
      permisos: JSON.stringify(permisos || []),
      esAdmin: esAdmin === true,
      empresaId: user.empresaId,
    },
  });

  return ok({ grupo: g });
}
