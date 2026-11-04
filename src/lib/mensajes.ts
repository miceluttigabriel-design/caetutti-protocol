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
    // 🛠️ Flag INFORCONF para usar en plantillas con {Informconf Alerta}
    "Informconf Alerta": cliente.informconf === "S"
      ? "⚠ AVISO: Su cuenta figura en INFORCONF. Regularice urgentemente para evitar acciones legales."
      : "",
    "Informconf": cliente.informconf === "S" ? "Sí" : "No",
    // 🛠️ Nombre del codeudor (para plantillas de codeudor que quieran personalizar saludo)
    "Nombre Codeudor": cliente.nombreCodeudor || "",
  };
}

// Para detalle (info de cada cuota)
export function varsCuota(cuota: any): Record<string, string | number> {
  const dias = cuota.diasAtrasado ?? 0;
  // 🛠️ FIX timezone: usar componentes UTC para no tener off-by-one (31/10 → 01/11)
  const fmtFecha = (d: any) => {
    if (!d) return "";
    const x = new Date(d);
    return `${String(x.getUTCDate()).padStart(2, "0")}/${String(x.getUTCMonth() + 1).padStart(2, "0")}/${x.getUTCFullYear()}`;
  };
  return {
    "Fecha Vcto": fmtFecha(cuota.fechaVcto),
    "Fecha Emision": fmtFecha(cuota.fechaEmision),
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
 * 🛠️ FIX robusto: itera TODAS las reglas y se queda con la que mejor coincida.
 * Si hay empate (varias coinciden), elige la de MAYOR ordenPie (más específica).
 * - diasMaxPie = -1  → rango abierto (181+ días, "en adelante")
 * - diasMaxPie = null → lo tratamos como -1 (rango abierto) por seguridad
 *   PERO solo se elige si no hay otra regla con max numérico que coincida.
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

  // 1) Primero buscar reglas con rango CERRADO (max numérico > 0) que coincidan
  //    — son las más específicas (0-7, 8-30, 31-60, etc.)
  for (const r of reglas) {
    const min = r.diasMinPie ?? 0;
    const max = r.diasMaxPie;
    // Solo reglas con max numérico positivo (no -1, no null)
    if (max !== null && max !== undefined && max > 0) {
      if (diasAtraso >= min && diasAtraso <= max) return r.mensaje;
    }
  }

  // 2) Si no encontró, buscar reglas con rango ABIERTO (max = -1 o null)
  //    — son las de "181+ días" / "en adelante"
  for (const r of reglas) {
    const min = r.diasMinPie ?? 0;
    const max = r.diasMaxPie;
    // Solo reglas de rango abierto (max = -1 o null)
    if (max === null || max === undefined || max === -1) {
      if (diasAtraso >= min) return r.mensaje;
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
    // 🛠️ FIX: si no hay reglas en BD, generar pie inteligente según días de atraso
    const reglaPie = await seleccionarPieDinamico(empresaId, maxDiasAtraso, "pie_cliente");
    const pieMsg = reglaPie || pieInteligenteCliente(maxDiasAtraso) || template.pieEstatico || "";
    // 🛠️ FIX: sustituir las variables del pie (como {dias_absolutos}) con la info
    // del cliente + la cuota con mayor atraso.
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

  // 🛠️ Componer mensaje final: si el titular está en INFORCONF, insertar aviso
  const partes = [cabecera];
  if (cliente.informconf === "S") {
    partes.push("⚠ AVISO: Su cuenta figura en INFORCONF. Regularice urgentemente para evitar acciones legales.");
  }
  // 🛠️ Solo agregar el detalle si no está vacío (puede ser "" si el usuario lo borró)
  if (detalles && detalles.trim()) partes.push(detalles);
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
    // 🛠️ FIX: si no hay reglas en BD (seed-pie-mora no ejecutado), generar un pie
    // inteligente según los días de atraso — en vez de caer al pieEstatico que
    // siempre es el mismo (amable) sin importar los días.
    const reglaPie = await seleccionarPieDinamico(empresaId, maxDiasAtraso, "pie_codeudor");
    const pieMsg = reglaPie || pieInteligenteCodeudor(maxDiasAtraso) || template.pieEstatico || "";
    // 🛠️ FIX: sustituir las variables del pie (como {dias_absolutos}, {Entidad}, etc.)
    // con la info del codeudor + la cuota con mayor atraso. Sin esto, las reglas
    // con {dias_absolutos} mostraban literalmente "{dias_absolutos}" en el mensaje.
    const cuotaMayorAtraso = cuotas.reduce((max, q) =>
      ((q.diasAtrasado ?? 0) > (max.diasAtrasado ?? 0)) ? q : max, cuotas[0] || {});
    const varsPie = {
      ...varsCliente(codeudor, totalGs, cuotas.length),
      ...varsCuota(cuotaMayorAtraso),
      // Para codeudor, {Entidad} en el pie = cliente deudor (titular), no el codeudor
      "Entidad": (cuotaMayorAtraso as any)?.cliente?.entidad || (codeudor as any)?.entidad || "",
      "Codigo Entidad": (cuotaMayorAtraso as any)?.cliente?.codigoEntidad || (codeudor as any)?.codigoEntidad || "",
    };
    pie = sustituirVariables(pieMsg, varsPie);
  } else {
    pie = template.pieEstatico || "";
  }

  // 🛠️ Componer mensaje final: si el titular está en INFORCONF, insertar aviso
  // (informconf viene en codeudor.informconf, copiado del titular por el route)
  const titularInformconf = (codeudor as any)?.informconf || "N";
  const partes = [cabecera];
  if (titularInformconf === "S") {
    partes.push("⚠ AVISO: La cuenta del titular figura en INFORCONF. Regularice urgentemente para evitar acciones legales.");
  }
  // 🛠️ Solo agregar el detalle si no está vacío
  if (detalles && detalles.trim()) partes.push(detalles);
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

// ============================================================
// PIES INTELIGENTES (fallback cuando no hay reglas en BD)
// ============================================================
// Se usan cuando seed-pie-mora no fue ejecutado. Garantizan que el mensaje
// tenga un pie con tono adecuado a los días de atraso, en vez del pieEstatico
// genérico (que siempre es el mismo, sin importar los días).
// ============================================================

function pieInteligenteCliente(dias: number): string {
  if (dias <= 7) {
    return "Le recordamos amablemente que su cuota está próxima a vencer o recientemente vencida. " +
      "Verifique el valor de su interés por mora para poder abonar su cuenta. " +
      "Consulte ahora mismo con su gestor en línea.\n\n" +
      "Atentamente,\nDpto. de Cobranzas — Casa Central\nVIZA HOME";
  }
  if (dias <= 30) {
    return "Su cuota tiene {dias_absolutos} días de atraso. Le solicitamos regularizar su situación a la brevedad. " +
      "Verifique el valor actualizado de su interés mora para poder abonar su cuenta. " +
      "Consulte ahora mismo con su gestor en línea.\n\n" +
      "Saludos cordiales,\nDpto. de Cobranzas — Casa Central\nVIZA HOME";
  }
  if (dias <= 60) {
    return "Su cuenta registra {dias_absolutos} días de mora. Le instamos a regularizar su pago de forma urgente, " +
      "ya que el interés por mora sigue acumulándose diariamente. " +
      "Verifique el valor exacto de su interés mora con su gestor en línea.\n\n" +
      "Dpto. de Cobranzas — Casa Central\nVIZA HOME";
  }
  if (dias <= 90) {
    return "IMPORTANTE: Su cuenta presenta {dias_absolutos} días de atraso. Último aviso antes de acciones de cobranza intensificada. " +
      "Verifique el valor actualizado de su interés mora con su gestor en línea y abone hoy mismo. " +
      "La falta de pago puede derivar en inclusión en Informconf y acciones legales.\n\n" +
      "Dpto. de Cobranzas — Casa Central\nVIZA HOME";
  }
  if (dias <= 180) {
    return "AVISO FINAL: Su deuda con {dias_absolutos} días de mora será derivada al departamento legal en 48 horas. " +
      "Última oportunidad de regularizar extrajudicialmente. " +
      "Verifique el valor actualizado de su interés mora con su gestor en línea y realice el pago total hoy mismo.\n\n" +
      "Dpto. de Cobranzas — Casa Central\nVIZA HOME";
  }
  return "NOTIFICACIÓN LEGAL: Su cuenta con {dias_absolutos} días de mora ha sido derivada al departamento legal " +
    "para el inicio de acciones judiciales. " +
    "Única instancia para evitar el proceso judicial: comuníquese HOY con su gestor en línea de VIZA HOME " +
    "para verificar el valor final de su interés mora y acordar el pago total.\n\n" +
    "Dpto. Legal — Casa Central\nVIZA HOME";
}

function pieInteligenteCodeudor(dias: number): string {
  if (dias <= 7) {
    return "Le informamos amablemente que la cuota del titular que usted avala está próxima a vencer o recientemente vencida. " +
      "Colabore gestionando el pago con el titular. " +
      "Verifique el valor del interés mora con su gestor en línea antes de abonar.\n\n" +
      "Atentamente,\nDpto. de Cobranzas — Casa Central\nVIZA HOME";
  }
  if (dias <= 30) {
    return "La cuota del titular que usted avala tiene {dias_absolutos} días de atraso. " +
      "En su calidad de codeudor/garante, le solicitamos colaborar gestionando la regularización con el titular. " +
      "Verifique el valor actualizado del interés mora con su gestor en línea antes de abonar.\n\n" +
      "Saludos cordiales,\nDpto. de Cobranzas — Casa Central\nVIZA HOME";
  }
  if (dias <= 60) {
    return "La cuenta del titular que usted avala registra {dias_absolutos} días de mora. " +
      "Como codeudor/garante, usted es solidariamente responsable de la deuda y el interés por mora sigue acumulándose. " +
      "Verifique el valor actualizado del interés mora con su gestor en línea antes de abonar.\n\n" +
      "Dpto. de Cobranzas — Casa Central\nVIZA HOME";
  }
  if (dias <= 90) {
    return "IMPORTANTE: La cuenta del titular que usted avala presenta {dias_absolutos} días de atraso. " +
      "Como codeudor/garante, VIZA HOME podrá exigirle directamente el pago total más el interés por mora acumulado. " +
      "Verifique el valor actualizado del interés mora con su gestor en línea y regularice a la brevedad.\n\n" +
      "Dpto. de Cobranzas — Casa Central\nVIZA HOME";
  }
  if (dias <= 180) {
    return "AVISO FINAL: La deuda del titular que usted avala, con {dias_absolutos} días de mora, " +
      "será derivada al departamento legal en 48 horas. " +
      "Como codeudor/garante solidario, será incluido en las acciones legales y en el reporte a Informconf. " +
      "Verifique el valor actualizado del interés mora con su gestor en línea y coordine el pago total HOY mismo.\n\n" +
      "Dpto. de Cobranzas — Casa Central\nVIZA HOME";
  }
  return "NOTIFICACIÓN LEGAL: La deuda del titular que usted avala, con {dias_absolutos} días de mora, " +
    "ha sido derivada al departamento legal. " +
    "Como codeudor/garante solidario, será demandado judicialmente junto con el titular. " +
    "Comuníquese HOY con su gestor en línea de VIZA HOME para verificar el valor final del interés mora y acordar el pago total.\n\n" +
    "Dpto. Legal — Casa Central\nVIZA HOME";
}
