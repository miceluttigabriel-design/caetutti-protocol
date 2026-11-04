import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/reset-mensajes
 *
 * Actualiza los templates de mensajes existentes (TemplateAgrupada y
 * TemplateCodeudor) con los nuevos defaults:
 *  - Pie estático: "Verifique el valor de su interés mora para poder abonar
 *    su cuenta. Consulte ahora mismo con su gestor en línea."
 *
 * Esto es necesario porque los templates que ya están en la BD NO se actualizan
 * automáticamente cuando se cambian los defaults en `src/lib/mensajes.ts`.
 *
 * Requiere permiso de admin.
 *
 * Uso (consola del navegador, F12 → "allow pasting"):
 *   fetch('/api/admin/reset-mensajes', { method: 'POST' }).then(r => r.json()).then(console.log)
 */
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();
  if (user.rol !== "admin") return fail("Solo admin", 403);

  const nuevoPie = "Verifique el valor de su interés mora para poder abonar su cuenta. Consulte ahora mismo con su gestor en línea.";

  const resultados: any = { agrupada: 0, codeudor: 0 };

  // TemplateAgrupada (titular)
  const agg = await db.templateAgrupada.updateMany({
    where: { empresaId: user.empresaId },
    data: {
      cabecera: "Estimado/a {Entidad}, le informamos que tiene cuotas pendientes por un total de ₲ {Total Gs}.",
      detalle: "- Vence: {Fecha Vcto} · Saldo: ₲ {Saldo en Gs} · {dias_texto}",
      pieEstatico: nuevoPie,
    },
  });
  resultados.agrupada = agg.count;

  // TemplateCodeudor
  const cod = await db.templateCodeudor.updateMany({
    where: { empresaId: user.empresaId },
    data: {
      cabecera: "Estimado/a codeudor, le informamos que el cliente {Entidad} tiene cuotas pendientes por un total de ₲ {Total Gs}.",
      detalle: "- Vence: {Fecha Vcto} · Saldo: ₲ {Saldo en Gs} · {dias_texto}",
      pieEstatico: nuevoPie,
    },
  });
  resultados.codeudor = cod.count;

  return ok({
    mensaje: "Templates actualizados con el nuevo pie.",
    nuevoPie,
    actualizados: resultados,
  });
}
