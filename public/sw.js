/* ============================================================
   Caetutti Protocol — Service Worker (PWA)
   Estrategia anti-pérdida de datos:
   - Nada de datos de la API se cachea NUNCA (siempre red).
   - Solo se cachean assets estáticos con hash de contenido.
   - Si no hay conexión → página offline amigable.
   ============================================================ */

const VERSION = "caetutti-v2";
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/offline.html";

// Assets del shell que se pre-cachean (sin datos dinámicos)
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/caetutti-logo.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Limpiar caches de versiones viejas
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// ¿Es un asset estático con hash de contenido? (seguro de cachear)
function isHashedStatic(url) {
  // Todo lo que Next.js sirve bajo /_next/static/ lleva hash de contenido
  // (JS, CSS, fuentes en /media/). Es inmutable → seguro cachear.
  // Se excluye el modo desarrollo.
  if (
    url.pathname.startsWith("/_next/static/") &&
    !url.pathname.includes("/development/") &&
    /\.(js|css|woff2?|png|svg|jpg|jpeg|webp|ico)$/i.test(url.pathname)
  ) {
    return true;
  }
  // ej: /icons/icon-192-a1b2c3d4e5f6.png
  return (
    (url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/icons/") ||
      url.pathname === "/caetutti-logo.png" ||
      url.pathname === "/logo.svg" ||
      url.pathname === "/mask.svg") &&
    /-[0-9a-f]{8,}\.(js|css|woff2?|png|svg|jpg|jpeg|webp)$/i.test(
      url.pathname
    )
  );
}

async function trimCache(cache, max) {
  try {
    const keys = await cache.keys();
    for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
  } catch {}
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Solo mismo origen
  if (url.origin !== self.location.origin) return;

  // ---------------------------------------------------------
  // 1) API: SIEMPRE red, jamás cachear (cero riesgo de datos viejos)
  // ---------------------------------------------------------
  if (url.pathname.startsWith("/api/")) {
    if (req.method !== "GET") return; // POST/PUT/DELETE pasan directo
    event.respondWith(
      fetch(req).catch(() =>
        new Response(
          JSON.stringify({
            error: "Sin conexión. Tus datos están a salvo en el servidor; reconectate e intentá de nuevo.",
          }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        )
      )
    );
    return;
  }

  // ---------------------------------------------------------
  // 2) Navegaciones (HTML): red primero, offline.html de reserva
  // ---------------------------------------------------------
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(req);
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          const offline = await cache.match(OFFLINE_URL);
          return (
            offline ||
            new Response("Sin conexión", {
              status: 503,
              headers: { "Content-Type": "text/plain" },
            })
          );
        }
      })()
    );
    return;
  }

  // ---------------------------------------------------------
  // 3) Assets con hash: cache-first (son inmutables)
  // ---------------------------------------------------------
  if (req.method === "GET" && isHashedStatic(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res.ok) {
            cache.put(req, res.clone());
            trimCache(cache, 150); // evita que crezca sin límite entre despliegues
          }
          return res;
        } catch {
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // 4) Todo lo demás (chunks de dev, fonts, etc.): pasa directo a la red
});

// Permitir que la página dispare el skip waiting tras un aviso de actualización
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
