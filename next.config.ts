import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sin output: "standalone" para Vercel (Vercel maneja su propio output)
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Headers anti-caché para desarrollo
  async headers() {
    return [
      {
        // Anti-caché SOLO para páginas y API. Los archivos estáticos de Next
        // (/_next/static, /_next/image) y los iconos mantienen su caché larga
        // para que la app abra rápido y gaste menos datos en el celular.
        source: "/((?!_next/static|_next/image|icons/|caetutti-logo.png|logo.svg|mask.svg|favicon.ico).*)",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
      {
        // El service worker nunca debe quedar cacheado (para que se actualice)
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
