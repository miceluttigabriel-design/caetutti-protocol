import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/seed-pie-mora
 *
 * Crea/actualiza las reglas tipo PIE para CLIENTE y CODEUDOR con el enfoque
 * de que el cliente consulte el interés por mora con su gestor en línea.
 *
 * Tono gradual: amable → cordial → firme → estricto → severo → judicial.
 * Todos los pies terminan con la indicación de consultar el interés mora.
 *
 * Empresa: Viza Home · Dpto: Cobranzas - Casa Central
 *
 * Requiere permiso de admin.
 *
 * Body (opcional):
 *   { sobreescribir?: boolean }  // default: true (borra las reglas pie existentes)
 *
 * Uso (consola del navegador, F12 → "allow pasting"):
 *   fetch('/api/admin/seed-pie-mora', { method: 'POST', headers: {'Content-Type':'application/json'}, body: '{}' }).then(r=>r.json()).then(console.log)
 */

// ============================================================
// REGLAS PIE PARA CLIENTE (titular)
// ============================================================
const REGLAS_PIE_CLIENTE = [
  {
    nombre: "PIE CLIENTE — Por vencer / recién vencido (0-7 días)",
    diasMinPie: 0,
    diasMaxPie: 7,
    ordenPie: 1,
    mensaje:
      "Le recordamos amablemente que su cuota está próxima a vencer o recientemente vencida.\n\n" +
      "Este es su saldo pendiente de pago. Verifique el valor de su interés por mora para poder abonar su cuenta. " +
      "Consulte ahora mismo con su gestor en línea.\n\n" +
      "Atentamente,\n" +
      "Dpto. de Cobranzas — Casa Central\n" +
      "VIZA HOME",
  },
  {
    nombre: "PIE CLIENTE — Vencido leve (8-30 días)",
    diasMinPie: 8,
    diasMaxPie: 30,
    ordenPie: 2,
    mensaje:
      "Su cuota tiene {dias_absolutos} días de atraso. Le solicitamos de manera cordial " +
      "regularizar su situación a la brevedad posible.\n\n" +
      "Recuerde que el interés por mora se calcula por día de atraso. " +
      "Verifique el valor actualizado de su interés mora para poder abonar su cuenta. " +
      "Consulte ahora mismo con su gestor en línea.\n\n" +
      "Saludos cordiales,\n" +
      "Dpto. de Cobranzas — Casa Central\n" +
      "VIZA HOME",
  },
  {
    nombre: "PIE CLIENTE — Vencido moderado (31-60 días)",
    diasMinPie: 31,
    diasMaxPie: 60,
    ordenPie: 3,
    mensaje:
      "Su cuenta registra {dias_absolutos} días de mora. Le instamos a regularizar " +
      "su pago de forma urgente, ya que el interés por mora sigue acumulándose diariamente.\n\n" +
      "No incluya un monto estimado: verifique el valor exacto de su interés mora para poder abonar su cuenta. " +
      "Consulte ahora mismo con su gestor en línea y evite que su cuenta siga creciendo.\n\n" +
      "Dpto. de Cobranzas — Casa Central\n" +
      "VIZA HOME",
  },
  {
    nombre: "PIE CLIENTE — Vencido grave (61-90 días)",
    diasMinPie: 61,
    diasMaxPie: 90,
    ordenPie: 4,
    mensaje:
      "IMPORTANTE: Su cuenta presenta {dias_absolutos} días de atraso. " +
      "Este es un último aviso antes de iniciar acciones de cobranza intensificada.\n\n" +
      "El saldo pendiente más el interés por mora acumulado debe ser regularizado de manera inmediata. " +
      "La falta de pago puede derivar en la inclusión en registros de morosos (Informconf) y el inicio de acciones legales.\n\n" +
      "Verifique el valor actualizado de su interés mora con su gestor en línea y abone hoy mismo.\n\n" +
      "Dpto. de Cobranzas — Casa Central\n" +
      "VIZA HOME",
  },
  {
    nombre: "PIE CLIENTE — Vencido severo (91-180 días)",
    diasMinPie: 91,
    diasMaxPie: 180,
    ordenPie: 5,
    mensaje:
      "AVISO FINAL: Su deuda con {dias_absolutos} días de mora será derivada al " +
      "departamento legal en las próximas 48 horas.\n\n" +
      "Esta es su última oportunidad de regularizar extrajudicialmente y evitar:\n" +
      "• Inclusión definitiva en Informconf\n" +
      "• Inicio de acción judicial\n" +
      "• Recargos legales y honorarios profesionales\n\n" +
      "Para frenar el proceso, verifique el valor actualizado de su interés mora con su gestor en línea " +
      "y realice el pago total de la deuda hoy mismo.\n\n" +
      "Dpto. de Cobranzas — Casa Central\n" +
      "VIZA HOME",
  },
  {
    nombre: "PIE CLIENTE — Vencido crítico (181+ días)",
    diasMinPie: 181,
    diasMaxPie: -1,
    ordenPie: 6,
    mensaje:
      "NOTIFICACIÓN LEGAL: Su cuenta con {dias_absolutos} días de mora ha sido derivada " +
      "al departamento legal para el inicio de acciones judiciales.\n\n" +
      "El monto total adeudado, incluidos intereses por mora, costas y honorarios, será reclamado " +
      "por la vía judicial correspondiente.\n\n" +
      "Única instancia para evitar el proceso judicial: comuníquese HOY con su gestor en línea de VIZA HOME " +
      "para verificar el valor final de su interés mora y acordar el pago total de la deuda.\n\n" +
      "Dpto. Legal — Casa Central\n" +
      "VIZA HOME",
  },
];

// ============================================================
// REGLAS PIE PARA CODEUDOR
// ============================================================
const REGLAS_PIE_CODEUDOR = [
  {
    nombre: "PIE CODEUDOR — Por vencer / recién vencido (0-7 días)",
    diasMinPie: 0,
    diasMaxPie: 7,
    ordenPie: 1,
    mensaje:
      "Le informamos amablemente que la cuota del titular que usted avala está próxima a vencer " +
      "o recientemente vencida. Le solicitamos de manera preventiva colaborar gestionando el pago " +
      "con el titular.\n\n" +
      "Recuerde que el interés por mora puede variar según los días de atraso. " +
      "Verifique el valor del interés mora con su gestor en línea antes de abonar.\n\n" +
      "Atentamente,\n" +
      "Dpto. de Cobranzas — Casa Central\n" +
      "VIZA HOME",
  },
  {
    nombre: "PIE CODEUDOR — Vencido leve (8-30 días)",
    diasMinPie: 8,
    diasMaxPie: 30,
    ordenPie: 2,
    mensaje:
      "La cuota del titular que usted avala tiene {dias_absolutos} días de atraso. " +
      "En su calidad de codeudor/garante, le solicitamos de manera cordial que colabore " +
      "gestionando la regularización con el titular.\n\n" +
      "El interés por mora se acumula diariamente. Verifique el valor actualizado del interés mora " +
      "con su gestor en línea antes de abonar.\n\n" +
      "Saludos cordiales,\n" +
      "Dpto. de Cobranzas — Casa Central\n" +
      "VIZA HOME",
  },
  {
    nombre: "PIE CODEUDOR — Vencido moderado (31-60 días)",
    diasMinPie: 31,
    diasMaxPie: 60,
    ordenPie: 3,
    mensaje:
      "La cuenta del titular que usted avala registra {dias_absolutos} días de mora. " +
      "Le recordamos que como codeudor/garante, usted es solidariamente responsable " +
      "de la deuda y el interés por mora sigue acumulándose.\n\n" +
      "Le instamos a coordinar con el titular la regularización urgente. " +
      "Verifique el valor actualizado del interés mora con su gestor en línea antes de abonar.\n\n" +
      "Dpto. de Cobranzas — Casa Central\n" +
      "VIZA HOME",
  },
  {
    nombre: "PIE CODEUDOR — Vencido grave (61-90 días)",
    diasMinPie: 61,
    diasMaxPie: 90,
    ordenPie: 4,
    mensaje:
      "IMPORTANTE: La cuenta del titular que usted avala presenta {dias_absolutos} días de atraso. " +
      "Le informamos que como codeudor/garante, VIZA HOME podrá exigirle directamente a usted " +
      "el pago total de la deuda más el interés por mora acumulado.\n\n" +
      "Este es un último aviso antes de iniciar gestiones de cobro intensificadas, " +
      "que pueden incluir reporte a Informconf y acciones legales.\n\n" +
      "Verifique el valor actualizado del interés mora con su gestor en línea y regularice a la brevedad.\n\n" +
      "Dpto. de Cobranzas — Casa Central\n" +
      "VIZA HOME",
  },
  {
    nombre: "PIE CODEUDOR — Vencido severo (91-180 días)",
    diasMinPie: 91,
    diasMaxPie: 180,
    ordenPie: 5,
    mensaje:
      "AVISO FINAL: La deuda del titular que usted avala, con {dias_absolutos} días de mora, " +
      "será derivada al departamento legal en las próximas 48 horas.\n\n" +
      "Como codeudor/garante solidario, usted será incluido en las acciones legales y en el " +
      "reporte a Informconf junto con el titular.\n\n" +
      "Última instancia para evitar el proceso judicial:\n" +
      "• Verifique el valor actualizado del interés mora con su gestor en línea\n" +
      "• Coordine el pago total de la deuda pendiente HOY mismo\n\n" +
      "Dpto. de Cobranzas — Casa Central\n" +
      "VIZA HOME",
  },
  {
    nombre: "PIE CODEUDOR — Vencido crítico (181+ días)",
    diasMinPie: 181,
    diasMaxPie: -1,
    ordenPie: 6,
    mensaje:
      "NOTIFICACIÓN LEGAL: La deuda del titular que usted avala, con {dias_absolutos} días de mora, " +
      "ha sido derivada al departamento legal.\n\n" +
      "Como codeudor/garante solidario, usted será demandado judicialmente junto con el titular " +
      "por el monto total de la deuda, intereses por mora, costas y honorarios profesionales.\n\n" +
      "Única instancia para evitar el proceso judicial en su contra:\n" +
      "Comuníquese HOY con su gestor en línea de VIZA HOME para verificar el valor final del interés mora " +
      "y acordar el pago total.\n\n" +
      "Dpto. Legal — Casa Central\n" +
      "VIZA HOME",
  },
];

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();
  if (user.rol !== "admin") {
    return fail("Solo el admin puede ejecutar esta acción", 403);
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const sobreescribir = body.sobreescribir !== false; // default: true

  // Si sobreescribir=true, borrar las reglas pie existentes primero
  let borradas = 0;
  if (sobreescribir) {
    const del = await db.regla.deleteMany({
      where: {
        empresaId: user.empresaId,
        tipo: { in: ["pie_cliente", "pie_codeudor"] },
      },
    });
    borradas = del.count;
  }

  // Crear las 12 reglas (6 para cliente + 6 para codeudor)
  const creadas: Array<{ id: string; nombre: string; tipo: string }> = [];
  for (const r of REGLAS_PIE_CLIENTE) {
    const nueva = await db.regla.create({
      data: {
        empresaId: user.empresaId,
        nombre: r.nombre,
        diasVcto: r.diasMinPie,
        mensaje: r.mensaje,
        activa: true,
        cooldownDias: 0,
        tipo: "pie_cliente",
        ordenPie: r.ordenPie,
        diasMinPie: r.diasMinPie,
        diasMaxPie: r.diasMaxPie,
      },
    });
    creadas.push({ id: nueva.id, nombre: nueva.nombre, tipo: "pie_cliente" });
  }

  for (const r of REGLAS_PIE_CODEUDOR) {
    const nueva = await db.regla.create({
      data: {
        empresaId: user.empresaId,
        nombre: r.nombre,
        diasVcto: r.diasMinPie,
        mensaje: r.mensaje,
        activa: true,
        cooldownDias: 0,
        tipo: "pie_codeudor",
        ordenPie: r.ordenPie,
        diasMinPie: r.diasMinPie,
        diasMaxPie: r.diasMaxPie,
      },
    });
    creadas.push({ id: nueva.id, nombre: nueva.nombre, tipo: "pie_codeudor" });
  }

  return ok({
    mensaje: `Seed completado: ${creadas.length} reglas creadas (${REGLAS_PIE_CLIENTE.length} cliente + ${REGLAS_PIE_CODEUDOR.length} codeudor).`,
    borradas,
    creadas: creadas.length,
    detalle: creadas,
    enfoque: "Cliente consulta interés por mora con su gestor en línea — no se menciona monto de interés.",
  });
}
