/**
 * Imágenes de las campañas de Promociones.
 *
 * Se comprimen en el navegador antes de subirlas: la foto de WhatsApp de un
 * celular puede pesar 3-8 MB y no entra cómoda ni en la base ni en el límite
 * de subida de Vercel. Con canvas la dejamos en ~200-500 KB sin que se note.
 */

export const IMAGEN_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
export const IMAGEN_MAX_ENTRADA = 12 * 1024 * 1024; // 12 MB el archivo original
export const IMAGEN_MAX_SAIDA = 3.5 * 1024 * 1024; // 3,5 MB ya comprimida

/** Ancho/alto máximo al que se redimensiona. WhatsApp muestra ~1600 px. */
const LADO_MAX = 1600;
const CALIDAD = 0.85;

export function esImagenValida(file: File): boolean {
  return (IMAGEN_MIMES as readonly string[]).includes(file.type);
}

/**
 * Redimensiona y recomprime la imagen a JPEG. Si ya es chica, la devuelve
 * tal cual. Lanza un Error con un mensaje en castellano si no sirve.
 */
export async function prepararImagen(file: File): Promise<File> {
  if (!esImagenValida(file)) {
    throw new Error("La imagen tiene que ser JPG, PNG o WebP");
  }
  if (file.size > IMAGEN_MAX_ENTRADA) {
    throw new Error("La imagen pesa más de 12 MB. Achicála o mandá otra.");
  }

  // Si ya es un JPEG liviano, no vale la pena recomprimir.
  if (file.type === "image/jpeg" && file.size <= 600 * 1024) return file;

  const bitmap = await cargarImagen(file);
  const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.max(1, Math.round(bitmap.width * escala));
  const alto = Math.max(1, Math.round(bitmap.height * escala));

  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  // Fondo blanco: los PNG con transparencia quedan lindos como JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, ancho, alto);
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, ancho, alto);
  if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", CALIDAD)
  );
  if (!blob) return file;
  if (blob.size > IMAGEN_MAX_SAIDA) {
    throw new Error("La imagen quedó muy pesada incluso comprimida. Probá con otra.");
  }

  const nombre = file.name.replace(/\.[^.]+$/, "") || "promo";
  return new File([blob], `${nombre}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}

type ImagenCargada = ImageBitmap | HTMLImageElement;

async function cargarImagen(file: File): Promise<ImagenCargada> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Safari viejo: seguimos con <img>
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("No pude leer la imagen"));
      img.src = url;
    });
  } finally {
    // El objeto ya quedó decodificado; el GC lo libera.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

/** Convierte un File a data URL para la vista previa. */
export function previewDeImagen(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result || ""));
    lector.onerror = () => reject(new Error("No pude leer la imagen"));
    lector.readAsDataURL(file);
  });
}
