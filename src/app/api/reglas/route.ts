import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";

/**
 * GET /api/reglas?tipo=individual|pie_cliente|pie_codeudor
 */
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get("tipo"); // individual | pie_cliente | pie_codeudor | todas

  const where: any = { empresaId: user.empresaId };
  if (tipo && tipo !== "todas") where.tipo = tipo;

  let orderBy: any = [{ diasVcto: "asc" }];
  if (tipo === "pie_cliente" || tipo === "pie_codeudor") {
    orderBy = [{ ordenPie: "asc" }];
  }

  const reglas = await db.regla.findMany({ where, orderBy });
  return ok({ reglas });
}

/**
 * POST /api/reglas — crea una regla
 * Body: {
 *   nombre, diasVcto, mensaje, activa, cooldownDias,
 *   tipo: "individual" | "pie_cliente" | "pie_codeudor",
 *   ordenPie?, diasMinPie?, diasMaxPie?
 * }
 */
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const body = await req.json();
  const { nombre, diasVcto, mensaje, activa, cooldownDias, tipo, ordenPie, diasMinPie, diasMaxPie } = body;

  if (!nombre || mensaje === undefined) {
    return fail("nombre y mensaje son requeridos");
  }

  const tipoValido = ["individual", "pie_cliente", "pie_codeudor"].includes(tipo || "individual");
  if (!tipoValido) return fail("tipo inválido");

  const regla = await db.regla.create({
    data: {
      empresaId: user.empresaId,
      nombre,
      diasVcto: Number(diasVcto) || 0,
      mensaje,
      activa: activa !== false,
      cooldownDias: Number(cooldownDias) || 0,
      tipo: tipo || "individual",
      ordenPie: ordenPie != null ? Number(ordenPie) : null,
      diasMinPie: diasMinPie != null ? Number(diasMinPie) : null,
      diasMaxPie: diasMaxPie != null ? Number(diasMaxPie) : null,
    },
  });

  return ok({ regla });
}
