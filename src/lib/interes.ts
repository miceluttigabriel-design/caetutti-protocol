/**
 * Helper para cálculo de interés por mora.
 *
 * Tasa: 0.10% diario (0.001 en decimal) = 36.5% anual
 *
 * Fórmula: interés = saldoGs × tasaDiaria × díasAtrasado
 * Solo calcula si diasAtrasado > 0 (después del vencimiento)
 *
 * El interés se calcula sobre el saldo pendiente original (saldoGs),
 * no sobre saldo + interés (no es interés compuesto).
 */

export const TASA_INTERES_DIARIA = 0.001; // 0.10%
export const TASA_INTERES_ANUAL = 0.365; // 36.5%

export interface InteresResult {
  saldoGs: number;
  interesGs: number;
  saldoTotalGs: number;
  diasAtrasado: number;
  tasaDiaria: number;
}

/**
 * Calcula el interés por mora sobre un saldo.
 *
 * @param saldoGs Saldo pendiente original
 * @param diasAtrasado Días de atraso (solo > 0 genera interés)
 * @param tasaDiaria Tasa diaria (default 0.001 = 0.10%)
 */
export function calcularInteres(
  saldoGs: number,
  diasAtrasado: number,
  tasaDiaria: number = TASA_INTERES_DIARIA
): InteresResult {
  const dias = Math.max(0, diasAtrasado);
  const interes = dias > 0 ? Math.round(saldoGs * tasaDiaria * dias) : 0;
  return {
    saldoGs: Math.round(saldoGs),
    interesGs: interes,
    saldoTotalGs: Math.round(saldoGs) + interes,
    diasAtrasado: dias,
    tasaDiaria,
  };
}

/**
 * Recalcula el interés basándose en la fecha actual.
 * Útil para actualizar intereses que cambian diariamente.
 */
export function recalcularInteresPorFecha(
  saldoGs: number,
  fechaVcto: Date,
  tasaDiaria: number = TASA_INTERES_DIARIA
): InteresResult {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const vcto = new Date(fechaVcto);
  vcto.setHours(0, 0, 0, 0);

  const diffMs = hoy.getTime() - vcto.getTime();
  const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return calcularInteres(saldoGs, dias, tasaDiaria);
}

/**
 * Formatea el interés para mostrar en la UI.
 */
export function fmtInteres(result: InteresResult): {
  saldo: string;
  interes: string;
  total: string;
  dias: number;
} {
  const fmt = (n: number) => new Intl.NumberFormat("es-PY").format(Math.round(n));
  return {
    saldo: `₲ ${fmt(result.saldoGs)}`,
    interes: `₲ ${fmt(result.interesGs)}`,
    total: `₲ ${fmt(result.saldoTotalGs)}`,
    dias: result.diasAtrasado,
  };
}
