/**
 * Promociones / ventas por WhatsApp — helpers compartidos.
 *
 * La idea es simple: subís un Excel con nombre + teléfono (+ modelo), elegís
 * un mensaje y el sistema lo manda por la API o te abre wa.me uno por uno.
 * Nada de esto toca clientes, cuotas ni deudas.
 */

export const MODOS_ENVIO = [
  { key: "manual", label: "Manual (ZapFast / wa.me)", desc: "Abre el chat en ZapFast o WhatsApp y copia el mensaje; pegás y enviás vos." },
  { key: "api", label: "Automático (API)", desc: "El sistema manda solo, con el WhatsApp conectado." },
  { key: "copiar", label: "Copiar y pegar", desc: "Copia el mensaje al portapapeles para pegarlo en WhatsApp o ZapFast." },
] as const;

export type ModoEnvio = (typeof MODOS_ENVIO)[number]["key"];

export const ESTADOS_PROMO: Record<string, { label: string; badge: string }> = {
  borrador: { label: "Borrador", badge: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
  enviando: { label: "Enviando", badge: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  finalizada: { label: "Finalizada", badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
};

export const ESTADOS_CONTACTO: Record<string, { label: string; badge: string }> = {
  pendiente: { label: "Pendiente", badge: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
  enviado: { label: "Enviado", badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  error: { label: "Error", badge: "bg-red-500/15 text-red-300 border-red-500/30" },
  omitido: { label: "Sin teléfono", badge: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
};

export const VARIABLES_PROMO = [
  { key: "{nombre}", desc: "Nombre del contacto" },
  { key: "{modelo}", desc: "Modelo de interés" },
  { key: "{localidad}", desc: "Ciudad / barrio" },
  { key: "{ci}", desc: "Cédula" },
] as const;

export const MENSAJE_EJEMPLO =
  "¡Hola {nombre}! 👋 Soy de Reimpex Motos. Tenemos una promo especial en {modelo} con entrega desde ₲1.500.000 y cuotas que te van a gustar. ¿Te paso los detalles?";

/** Reemplaza las variables del mensaje sin romper si falta algún dato. */
export function aplicarVariables(
  mensaje: string,
  datos: {
    nombre?: string | null;
    modelo?: string | null;
    localidad?: string | null;
    ci?: string | null;
  }
): string {
  const mapa: Record<string, string> = {
    nombre: (datos.nombre || "").trim() || "amigo/a",
    modelo: (datos.modelo || "").trim() || "nuestras motos",
    localidad: (datos.localidad || "").trim() || "",
    ci: (datos.ci || "").trim() || "",
  };

  return mensaje.replace(/\{(nombre|modelo|localidad|ci)\}/gi, (_m, key: string) => {
    const valor = mapa[key.toLowerCase()] || "";
    // Si la variable quedó vacía, limpiamos dobles espacios que pueda dejar.
    return valor;
  });
}

/** Link de wa.me listo para abrir con el texto cargado. */
export function linkWhatsapp(telefono: string, mensaje: string): string {
  const limpio = String(telefono || "").replace(/\D/g, "");
  let phone = limpio;
  if (limpio.length === 10 && limpio.startsWith("09")) phone = "595" + limpio.slice(1);
  else if (limpio.length === 9 && limpio.startsWith("9")) phone = "595" + limpio;
  if (!phone) return "#";
  return `https://wa.me/${phone}?text=${encodeURIComponent(mensaje)}`;
}

/**
 * Copia texto al portapapeles. Usa la API moderna y cae a un textarea oculto
 * si el navegador no la deja usar (http sin certificado, por ejemplo).
 */
export async function copiarAlPortapapeles(texto: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // seguimos con el método viejo
  }

  try {
    const area = document.createElement("textarea");
    area.value = texto;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.focus();
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/** Normaliza encabezados de Excel: sin acentos, minúsculas y sin símbolos. */
export function normalizarEncabezado(valor: unknown): string {
  return String(valor ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Busca en la fila la columna cuyo encabezado coincida con alguno de los alias.
 * Primero intenta coincidencia exacta; después, "contiene" (solo para alias de
 * 4+ letras, para que "ci" no se confunda con "ciudad" o "domicilio").
 */
export function buscarValor(
  fila: Record<string, unknown>,
  alias: string[]
): string | null {
  const entradas = Object.entries(fila).map(([encabezado, valor]) => ({
    clave: normalizarEncabezado(encabezado),
    valor,
  }));

  for (const { clave, valor } of entradas) {
    if (!clave) continue;
    if (alias.includes(clave)) {
      const texto = String(valor ?? "").trim();
      if (texto) return texto;
    }
  }

  const largos = alias.filter((a) => a.length >= 4);
  for (const { clave, valor } of entradas) {
    if (!clave) continue;
    if (largos.some((a) => clave.includes(a))) {
      const texto = String(valor ?? "").trim();
      if (texto) return texto;
    }
  }

  return null;
}

export const ALIAS_COLUMNAS = {
  nombre: ["nombre", "entidad", "cliente", "apellido", "razonsocial", "contacto"],
  telefono: ["telefono", "celular", "whatsapp", "movil", "tel", "phone", "numero"],
  modelo: ["modelo", "moto", "producto", "interes", "vehiculo"],
  localidad: ["localidad", "ciudad", "barrio", "distrito"],
  ci: ["ci", "cedula", "documento", "ruc", "dni"],
  notas: ["nota", "observacion", "comentario", "detalle"],
} as const;

/** Etiqueta corta del modo de envío. */
export function modoLabel(key: string): string {
  return MODOS_ENVIO.find((m) => m.key === key)?.label ?? key;
}

/** Saca repetidos por teléfono para no mandarle dos veces al mismo número. */
export function deduplicarPorTelefono<
  T extends { telefono: string; telefonoNormalizado: string | null }
>(filas: T[]): { filas: T[]; duplicados: number } {
  const vistos = new Set<string>();
  const unicas: T[] = [];
  let duplicados = 0;

  for (const fila of filas) {
    const clave = (fila.telefonoNormalizado || fila.telefono).replace(/\D/g, "");
    if (clave && vistos.has(clave)) {
      duplicados++;
      continue;
    }
    if (clave) vistos.add(clave);
    unicas.push(fila);
  }

  return { filas: unicas, duplicados };
}
