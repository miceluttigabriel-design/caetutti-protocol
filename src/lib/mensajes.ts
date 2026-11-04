/**
 * Motor de generación de mensajes de cobranza.
 *
 * Genera mensajes en 3 modos:
 * 1.Individual: una sola cuota, usa una regla individual
 * 2. Agrupado: TODAS las cuotas de un cliente en un solo mensaje
 *    Estructura: Cabecera + (Detalle × N cuotas) + Pie dinámico
 * 3. Codeudor: igual que agrupado pero con template de codeudor
 *
 * El pie dinámico se selecciona automáticamente según la cuota con MAYOR atraso.
 */

import { db } from "./db";
import { sustituirVariables } from "./meta";
import { diasText, diasEstado } from "./format";

// ============================================================
// VARIABLES DISPONIBLES PARA PLANTILLAS
// ============================================================

// Para cabecera/pie (info del cliente)
export function varsCliente(cliente: any, totalGs: number, cantidadCuotas: number): Record<string, string | number> {
  return {
    "Entidad": cliente.entidad || "",
    "Codigo Entidad": cliente.codigoEntidad || "",
    "Ci Entidad": cliente.ciEntidad || "",
    "Ruc Entidad": cliente.rucEntidad || "",
    "Localidad": cliente.localidad || "",
    "Telefono": cliente.telefono || "",
    "Telefono_pivot": cliente.telefonoPivot || "",
    "Total Gs": new Intl.NumberFormat("es-PY").format(totalGs),
    "Cantidad Cuotas": cantidadCuotas, // disponible pero NO se incluye por defecto
    "Vendedor": cliente.vendedor || "",
    "Sucursal": cliente.sucursal?.nombre || "",
  };
}

// Para detalle (info de cada cuota)
export function varsCuota(cuota: any): Record<string, string | number> {
  const dias = cuota.diasAtrasado ?? 0;
  // 🛠️ FIX: usamos saldoGs directo (no saldoTotalGs) — no trabajamos con interés.
  return {
    "Fecha Vcto": cuota.fechaVcto ? `${String(new Date(cuota.fechaVcto).getUTCDate()).padStart(2, "0")}/${String(new Date(cuota.fechaVcto).getUTCMonth() + 1).padStart(2, "0")}/${new Date(cuota.fechaVcto).getUTCFullYear()}` : "",
    "Fecha Emision": cuota.fechaEmision ? `${String(new Date(cuota.fechaEmision).getUTCDate()).padStart(2, "0")}/${String(new Date(cuota.fechaEmision).getUTCMonth() + 1).padStart(2, "0")}/${new Date(cuota.fechaEmision).getUTCFullYear()}` : "",
    "Saldo en Gs": new Intl.NumberFormat("es-PY").format(cuota.saldoGs || 0),
    "Saldo Guarani": new Intl.NumberFormat("es-PY").format(cuota.saldoGuarani || 0),
    "Saldo Dolar": new Intl.NumberFormat("es-PY").format(cuota.saldoDolar || 0),
    "Venc Mes": new Intl.NumberFormat("es-PY").format(cuota.vencMes || cuota.saldoGs || 0),
    "Moneda": cuota.moneda || "Gs",
    "Dias Atrasado": dias,
    "dias_texto": diasText(dias),
    "dias_estado": diasEstado(dias),
    "dias_absolutos": Math.abs(dias),
    "dias_signo": dias > 0 ? "+" : dias < 0 ? "-" : "",
    "Vendedor": cuota.vendedor || "",
    "Sucursal": cuota.sucursal?.nombre || "",
  };
}

// ============================================================
// SELECCIONAR PIE DINÁMICO SEGÚN DÍAS DE ATRASO
// ============================================================

/**
 * Busca la regla de pie que corresponde al rango de días.
 * Si diasMaxPie = -1, significa "en adelante" (90+).
 */
export async function seleccionarPieDinamico(
  empresaId: string,
  diasAtraso: number,
  tipo: "pie_cliente" | "pie_codeudor"
): Promise<string | null> {
  const reglas = await db.regla.findMany({
    where: { empresaId, tipo, activa: true },
    orderBy: { ordenPie: "asc" },
  });

  for (const r of reglas) {
    const min = r.diasMinPie ?? 0;
    const max = r.diasMaxPie ?? -1;
    if (max === -1) {
      // Rango abierto: 91+ días
      if (diasAtraso >= min) return r.mensaje;
    } else {
      if (diasAtraso >= min && diasAtraso <= max) return r.mensaje;
    }
  }
  return null;
}

// ============================================================
// GENERAR MENSAJE AGRUPADO (cliente con todas sus cuotas)
// ============================================================

export async function generarMensajeAgrupado(
  empresaId: string,
  cliente: any,
  cuotas: any[]
): Promise<string> {
  // Calcular total y máxima días de atraso
  const totalGs = cuotas.reduce((s, q) => s + (q.saldoGs || 0), 0);
  const maxDiasAtraso = Math.max(0, ...cuotas.map((q) => q.diasAtrasado ?? 0));

  // Buscar template agrupada
  let template = await db.templateAgrupada.findUnique({ where: { empresaId } });

  // Si no existe, crear con defaults razonables
  if (!template) {
    template = await db.templateAgrupada.create({
      data: {
        empresaId,
        cabecera: "Estimado/a {Entidad}, le informamos que tiene cuotas pendientes por un total de ₲ {Total Gs}.",
        detalle: "- Vence: {Fecha Vcto} · Saldo: ₲ {Saldo en Gs} · {dias_texto}",
        pieEstatico: "Verifique el valor de su interés mora para poder abonar su cuenta. Consulte ahora mismo con su gestor en línea.",
        usarReglasDinamicas: true,
      },
    });
  }

  // 1. Cabecera
  const varsCab = varsCliente(cliente, totalGs, cuotas.length);
  const cabecera = sustituirVariables(template.cabecera, varsCab);

  // 2. Detalle (repetido por cada cuota)
  const detalles = cuotas.map((q) => {
    const vars = varsCuota(q);
    return sustituirVariables(template.detalle, vars);
  }).join("\n");

  // 3. Pie dinámico o estático
  let pie = "";
  if (template.usarReglasDinamicas) {
    const pieMsg = await seleccionarPieDinamico(empresaId, maxDiasAtraso, "pie_cliente") || template.pieEstatico || "";
    // Aplicar sustitución de variables al pie (cliente + cuota con mayor atraso)
    const cuotaMayorAtraso = cuotas.reduce((max, q) =>
      ((q.diasAtrasado ?? 0) > (max.diasAtrasado ?? 0)) ? q : max, cuotas[0] || {});
    const varsPie = {
      ...varsCliente(cliente, totalGs, cuotas.length),
      ...varsCuota(cuotaMayorAtraso),
    };
    pie = sustituirVariables(pieMsg, varsPie);
  } else {
    pie = template.pieEstatico || "";
  }

  // Componer mensaje final
  const partes = [cabecera, detalles];
  if (pie) partes.push(pie);
  return partes.join("\n\n");
}

// ============================================================
// GENERAR MENSAJE PARA CODEUDOR
// ============================================================

export async function generarMensajeCodeudor(
  empresaId: string,
  codeudor: any,
  cuotas: any[] // cuotas donde el codeudor figura como garante
): Promise<string> {
  const totalGs = cuotas.reduce((s, q) => s + (q.saldoGs || 0), 0);
  const maxDiasAtraso = Math.max(0, ...cuotas.map((q) => q.diasAtrasado ?? 0));

  let template = await db.templateCodeudor.findUnique({ where: { empresaId } });

  if (!template) {
    template = await db.templateCodeudor.create({
      data: {
        empresaId,
        cabecera: "Estimado/a codeudor, le informamos que el cliente {Entidad} tiene cuotas pendientes por un total de ₲ {Total Gs}.",
        detalle: "- Vence: {Fecha Vcto} · Saldo: ₲ {Saldo en Gs} · {dias_texto}",
        pieEstatico: "Verifique el valor de su interés mora para poder abonar su cuenta. Consulte ahora mismo con su gestor en línea.",
        usarReglasDinamicas: true,
      },
    });
  }

  // Cabecera usa info del codeudor (no del cliente deudor)
  const varsCab = varsCliente(codeudor, totalGs, cuotas.length);
  const cabecera = sustituirVariables(template.cabecera, varsCab);

  // Detalle por cada cuota (usa info de cada cuota + cliente deudor)
  const detalles = cuotas.map((q) => {
    const vars = {
      ...varsCuota(q),
      // Para codeudor, {Entidad} en el detalle = cliente deudor (no el codeudor)
      "Entidad": q.cliente?.entidad || "",
      "Codigo Entidad": q.cliente?.codigoEntidad || "",
    };
    return sustituirVariables(template.detalle, vars);
  }).join("\n");

  // Pie
  let pie = "";
  if (template.usarReglasDinamicas) {
    const pieMsg = await seleccionarPieDinamico(empresaId, maxDiasAtraso, "pie_codeudor") || template.pieEstatico || "";
    // Aplicar sustitución de variables al pie (codeudor + cuota con mayor atraso)
    const cuotaMayorAtraso = cuotas.reduce((max, q) =>
      ((q.diasAtrasado ?? 0) > (max.diasAtrasado ?? 0)) ? q : max, cuotas[0] || {});
    const varsPie = {
      ...varsCliente(codeudor, totalGs, cuotas.length),
      ...varsCuota(cuotaMayorAtraso),
    };
    pie = sustituirVariables(pieMsg, varsPie);
  } else {
    pie = template.pieEstatico || "";
  }

  const partes = [cabecera, detalles];
  if (pie) partes.push(pie);
  return partes.join("\n\n");
}

// ============================================================
// GENERAR MENSAJE INDIVIDUAL (una sola cuota, una regla)
// ============================================================

export function generarMensajeIndividual(
  reglaMensaje: string,
  cliente: any,
  cuota: any
): string {
  const vars = {
    ...varsCliente(cliente, cuota.saldoGs || 0, 1),
    ...varsCuota(cuota),
  };
  return sustituirVariables(reglaMensaje, vars);
}
