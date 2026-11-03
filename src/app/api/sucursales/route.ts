import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, unauthorized } from "@/lib/session";

export async function GET() {
  const user = await getSession();
  if (!user) return unauthorized();

  const sucursales = await db.sucursal.findMany({
    where: { empresaId: user.empresaId },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, codigo: true },
  });

  return ok({ sucursales });
}
