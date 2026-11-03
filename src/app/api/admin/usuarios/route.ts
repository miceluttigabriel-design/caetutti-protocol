import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, unauthorized } from "@/lib/session";

// GET /api/admin/usuarios
export async function GET() {
  const user = await getSession();
  if (!user) return unauthorized();
  if (user.rol !== "admin") {
    return Response.json({ error: "Solo admin" }, { status: 403 });
  }

  const usuarios = await db.usuario.findMany({
    where: { empresaId: user.empresaId },
    include: { grupo: { select: { id: true, nombre: true, esAdmin: true } } },
    orderBy: { nombre: "asc" },
  });

  const grupos = await db.grupo.findMany({
    where: { empresaId: user.empresaId },
    orderBy: { nombre: "asc" },
  });

  return ok({ usuarios, grupos });
}

// POST /api/admin/usuarios — crear usuario
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();
  if (user.rol !== "admin") {
    return Response.json({ error: "Solo admin" }, { status: 403 });
  }

  const body = await req.json();
  const { login, nombre, email, telefono, password, rol, grupoId, sucursalesPermitidas, debeCambiarPass } = body;

  if (!login || !nombre || !password) {
    return Response.json({ error: "login, nombre y password son requeridos" }, { status: 400 });
  }

  const bcrypt = (await import("bcryptjs")).default;
  const hash = await bcrypt.hash(password, 10);

  try {
    const u = await db.usuario.create({
      data: {
        login, nombre, email, telefono,
        passwordHash: hash,
        rol: rol || "usuario",
        empresaId: user.empresaId,
        grupoId: grupoId || null,
        sucursalesPermitidas: JSON.stringify(sucursalesPermitidas || []),
        debeCambiarPass: debeCambiarPass !== false,
        activo: true,
      },
    });
    return ok({ usuario: { ...u, passwordHash: undefined } });
  } catch (e: any) {
    if (e.code === "P2002") {
      return Response.json({ error: "Login ya existe" }, { status: 409 });
    }
    return Response.json({ error: e.message }, { status: 500 });
  }
}
