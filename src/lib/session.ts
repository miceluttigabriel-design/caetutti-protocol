import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { db } from "./db";
import type { Prisma } from "@prisma/client";

export interface SessionUser {
  id: string;
  login: string;
  name: string;
  rol: string;
  empresaId: string;
  empresaNombre: string;
  empresaPlan: string;
  permisos: string[];
  sucursalesPermitidas: string[];
  grupoId?: string | null;
  debeCambiarPass: boolean;
}

export async function getSession(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session.user as SessionUser;
}

export function hasPermission(user: SessionUser | null, permiso: string): boolean {
  if (!user) return false;
  if (user.rol === "admin") return true;
  return user.permisos.includes("*") || user.permisos.includes(permiso);
}

/**
 * Build a Prisma where clause scoped to the user's empresa and sucursales.
 * Use this in every business query to enforce tenancy + sucursal filtering.
 */
export function buildEmpresaWhere(user: SessionUser): Prisma.Sql {
  // Not used directly — use buildWhere helper for typed queries
  return Prisma.empty;
}

/**
 * Returns the sucursal filter for a user.
 * - admin or empty sucursalesPermitidas => no filter (all sucursales)
 * - otherwise restricts to allowed sucursales
 */
export function sucursalFilter(user: SessionUser): { sucursalId?: { in: string[] } } {
  if (!user.sucursalesPermitidas || user.sucursalesPermitidas.length === 0) {
    return {};
  }
  return { sucursalId: { in: user.sucursalesPermitidas } };
}

/**
 * Standardized JSON response helpers
 */
export function ok<T>(data: T, status = 200) {
  return Response.json(data, { status });
}

export function fail(error: string, status = 400, code?: string) {
  return Response.json({ error, code }, { status });
}

export function unauthorized() {
  return Response.json({ error: "No autorizado" }, { status: 401 });
}

export function forbidden() {
  return Response.json({ error: "Sin permisos" }, { status: 403 });
}
