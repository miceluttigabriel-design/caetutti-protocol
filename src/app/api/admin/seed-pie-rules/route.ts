import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/seed-pie-rules
 *
 * Crea las reglas tipo PIE para CLIENTE y CODEUDOR con tono gradual
 * según los días de atraso.
 *
 * Empresa: Viza Home
 * Dpto: Cobranzas - Casa Central
 *
 * Requiere permiso de admin.
 *
 * Body (opcional):
 *   { sobreescribir?: boolean }  // default: true (borra las reglas pie existentes antes de crear)
 */

// ============================================================
// REGLAS PIE PARA CLIENTE
// ============================================================
// Tono gradual: amable → cordial → firme → estricto → severo → judicial
// ============================================================
const REGLAS_PIE_CLIENTE = [
  {
    nombre: "PIE CLIENTE — Por vencer / recién vencido (0-7 días)",
    diasMinPie: 0,
    diasMaxPie: 7,
    ordenPie: 1,
    mensaje:
      "Le recordamos amablemente que su cuota está próxima a vencer o recientemente vencida. " +
      "Le agradecemos gestionar el pago a la brevedad para mantener su historial al día.\n\n" +
      "Para consultas o coordinación de pago, estamos a su disposición.\n\n" +
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
      "regularizar su situación a la brevedad posible para evitar recargos adicionales.\n\n" +
      "Puede comunicarse con nosotros para coordinar el pago o un plan alternativo.\n\n" +
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
      "su pago de forma urgente, ya que el interés por mora sigue acumulándose diariamente " +
      "y podría afectar su calificación crediticia.\n\n" +
      "Comuníquese a la brevedad con el Dpto. de Cobranzas para evitar mayores inconvenientes.\n\n" +
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
      "El saldo pendiente, incluido el interés acumulado, debe ser regularizado de manera " +
      "inmediata. La falta de pago puede derivar en la inclusión en registros de morosos " +
      "(Informconf) y el inicio de acciones legales.\n\n" +
      "Contáctenos hoy mismo.\n" +
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
      "Para frenar el proceso, comuníquese inmediatamente.\n\n" +
      "Dpto. de Cobranzas — Casa Central\n" +
      "VIZA HOME",
  },
  {
    nombre: "PIE CLIENTE — Vencido crítico (181+ días)",
    diasMinPie: 181,
    diasMaxPie: -1, // -1 = en adelante (rango abierto)
    ordenPie: 6,
    mensaje:
      "NOTIFICACIÓN LEGAL: Su cuenta con {dias_absolutos} días de mora ha sido derivada " +
      "al departamento legal para el inicio de acciones judiciales.\n\n" +
      "El monto total adeudado, incluidos intereses, costas y honorarios, será reclamado " +
      "por la vía judicial correspondiente.\n\n" +
      "Única instancia para evitar el proceso judicial: comuníquese HOY con el Dpto. Legal " +
      "de VIZA HOME para acordar el pago total de la deuda.\n\n" +
      "Dpto. Legal — Casa Central\n" +
      "VIZA HOME",
  },
];

// ============================================================
// REGLAS PIE PARA CODEUDOR
// ============================================================
// Mismo escalado de tono pero dirigido al codeudor/garante
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
      "Cualquier consulta, estamos a su disposición.\n\n" +
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
      "La cuota del titular que usted Avala tiene {dias_absolutos} días de atraso. " +
      "En su calidad de codeudor/garante, le solicitamos de manera cordial que colabore " +
      "gestionando la regularización con el titular.\n\n" +
      "Agradecemos su gestión.\n\n" +
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
      "La cuenta del titular que usted Avala registra {dias_absolutos} días de mora. " +
      "Le recordamos que como codeudor/garante, usted es solidariamente responsable " +
      "de la deuda y el interés por mora sigue acumulándose.\n\n" +
      "Le instamos a coordinar con el titular la regularización urgente, o a comunicarse " +
      "con nosotros para evaluar opciones.\n\n" +
      "Dpto. de Cobranzas — Casa Central\n" +
      "VIZA HOME",
  },
  {
    nombre: "PIE CODEUDOR — Vencido grave (61-90 días)",
    diasMinPie: 61,
    diasMaxPie: 90,
    ordenPie: 4,
    mensaje:
      "IMPORTANTE: La cuenta del titular que usted Avala presenta {dias_absolutos} días de atraso. " +
      "Le informamos que como codeudor/garante, VIZA HOME podrá exigirle directamente a usted " +
      "el pago total de la deuda.\n\n" +
      "Este es un último aviso antes de iniciar gestiones de cobro intensificadas, " +
      "que pueden incluir reporte a Informconf y acciones legales.\n\n" +
      "Le sugerimos gestionar la regularización a la brevedad.\n\n" +
      "Dpto. de Cobranzas — Casa Central\n" +
      "VIZA HOME",
  },
  {
    nombre: "PIE CODEUDOR — Vencido severo (91-180 días)",
    diasMinPie: 91,
    diasMaxPie: 180,
    ordenPie: 5,
    mensaje:
      "AVISO FINAL: La deuda del titular que usted Avala, con {dias_absolutos} días de mora, " +
      "será derivada al departamento legal en las próximas 48 horas.\n\n" +
      "Como codeudor/garnte solidario, usted será incluido en las acciones legales y en el " +
      "reporte a Informconf junto con el titular.\n\n" +
      "Última instancia para evitar el proceso judicial:\n" +
      "• Comuníquese HOY con el Dpto. de Cobranzas de VIZA HOME\n" +
      "• Coordinar el pago total de la deuda pendiente\n\n" +
      "Dpto. de Cobranzas — Casa Central\n" +
      "VIZA HOME",
  },
  {
    nombre: "PIE CODEUDOR — Vencido crítico (181+ días)",
    diasMinPie: 181,
    diasMaxPie: -1, // -1 = en adelante (rango abierto)
    ordenPie: 6,
    mensaje:
      "NOTIFICACIÓN LEGAL: La deuda del titular que usted Avala, con {dias_absolutos} días de mora, " +
      "ha sido derivada al departamento legal.\n\n" +
      "Como codeudor/garante solidario, usted será demandado judicialmente junto con el titular " +
      "por el monto total de la deuda, intereses, costas y honorarios profesionales.\n\n" +
      "Única instancia para evitar el proceso judicial en su contra:\n" +
      "Comuníquese HOY con el Dpto. Legal de VIZA HOME para acordar el pago.\n\n" +
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
  const creadas = [];
  for (const r of REGLAS_PIE_CLIENTE) {
    const nueva = await db.regla.create({
      data: {
        empresaId: user.empresaId,
        nombre: r.nombre,
        diasVcto: r.diasMinPie, // campo legacy, usamos diasMinPie/diasMaxPie
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
    mensaje: "Reglas PIE creadas correctamente",
    reglasBorradas: borradas,
    reglasCreadas: creadas.length,
    detalle: creadas,
    rangos: [
      { dias: "0-7", tono: "Amable / preventivo" },
      { dias: "8-30", tono: "Cordial / recordatorio" },
      { dias: "31-60", tono: "Firme / urgente" },
      { dias: "61-90", tono: "Estricto / último aviso" },
      { dias: "91-180", tono: "Severo / derivación legal" },
      { dias: "181+", tono: "Crítico / judicial" },
    ],
  });
}
