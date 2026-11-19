/**
 * Normalización de teléfonos paraguayos.
 *
 * Vive aparte de `meta.ts` a propósito: así el panel de Promociones puede
 * usarla en el navegador (para leer el Excel) sin arrastrar Prisma ni las
 * credenciales de WhatsApp al bundle del cliente.
 */

/**
 * Normaliza un teléfono al formato internacional requerido por Meta.
 * - "0981123456" → "595981123456"
 * - "+595981123456" → "595981123456"
 * - "595981123456" → "595981123456"
 */
export function normalizarTelefonoPY(phone: string): string | null {
  if (!phone) return null;
  const clean = phone.replace(/\D/g, "");
  // Caso: 09XX XXX XXX → 595 9XX XXX XXX
  if (clean.length === 10 && clean.startsWith("09")) {
    return "595" + clean.slice(1);
  }
  // Caso: 9XX XXX XXX sin 0 (raro)
  if (clean.length === 9 && clean.startsWith("9")) {
    return "595" + clean;
  }
  // Ya está en formato internacional
  if (clean.length === 12 && clean.startsWith("595")) {
    return clean;
  }
  if (clean.length === 13 && clean.startsWith("595")) {
    return clean;
  }
  // Caso: 595 + 9 dígitos (algunos números paraguayos)
  if (clean.length === 11 && clean.startsWith("595")) {
    return clean;
  }
  // Fallback: si no matchea ningún patrón pero tiene al menos 6 dígitos,
  // devolver el número limpio (sin descartarlo)
  if (clean.length >= 6) {
    return clean;
  }
  return null;
}

/**
 * Igual que la anterior, pero solo devuelve números que realmente son
 * celulares paraguayos (595 + 9 dígitos). Sirve para promociones: mandar a una
 * fija o a un número raro es gastar API al pedo.
 */
export function normalizarCelularPY(phone: string): string | null {
  const n = normalizarTelefonoPY(phone);
  if (!n) return null;
  return n.startsWith("595") && n.length === 12 ? n : null;
}
