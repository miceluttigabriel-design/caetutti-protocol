/**
 * Format helpers — Guaraníes (₲), dates (es-PY), numbers
 */

export function fmtGs(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "₲ 0";
  return `₲ ${new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(value)}`;
}

export function fmtGsShort(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "₲ 0";
  const n = Number(value);
  if (Math.abs(n) >= 1_000_000_000) return `₲ ${(n / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(n) >= 1_000_000) return `₲ ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `₲ ${(n / 1_000).toFixed(0)}K`;
  return `₲ ${n}`;
}

export function fmtNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "0";
  return new Intl.NumberFormat("es-PY").format(value);
}

export function fmtPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || isNaN(value)) return "0%";
  return `${Number(value).toFixed(digits)}%`;
}

export function fmtDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function fmtDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("es-PY", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function fmtRelative(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "hace un momento";
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `hace ${day} d`;
  return fmtDate(d);
}

export function fmtPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  // Paraguay: 09XX XXX XXX o 595 XXX XXX XXX
  const clean = phone.replace(/\D/g, "");
  if (clean.length === 10 && clean.startsWith("09")) {
    return `${clean.slice(0, 4)} ${clean.slice(4, 7)} ${clean.slice(7)}`;
  }
  if (clean.length === 12 && clean.startsWith("595")) {
    return `+595 ${clean.slice(3, 6)} ${clean.slice(6, 9)} ${clean.slice(9)}`;
  }
  return phone;
}

export function diasText(dias: number): string {
  if (dias > 0) return `vencida hace ${dias} días`;
  if (dias === 0) return "vence hoy";
  return `vence en ${Math.abs(dias)} días`;
}

export function diasEstado(dias: number): string {
  if (dias > 0) return "vencida";
  if (dias === 0) return "vence hoy";
  return "por vencer";
}
