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
        source: "/(.*)",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
    ];
  },
};

export default nextConfig;
