import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Share_Tech_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { PwaRegister } from "@/components/pwa/pwa-register";

const jetbrains = JetBrains_Mono({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const techMono = Share_Tech_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Caetutti Protocol — Debt Collection System",
  description: "Sistema de gestión de cobranzas con WhatsApp, IA y automatización.",
  applicationName: "Caetutti Protocol",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-64.png", sizes: "64x64", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Caetutti",
  },
  formatDetection: { telephone: false },
  // Forzar no-caché para que los cambios se vean inmediatamente
  other: {
    "cache-control": "no-cache, no-store, must-revalidate",
    "pragma": "no-cache",
    "expires": "0",
  },
};

// Viewport PWA: viewport-fit=cover permite pintar bajo el notch (safe areas)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#050807",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning className="dark scanlines">
      <body className={`${jetbrains.variable} ${techMono.variable} antialiased bg-background text-foreground`}>
        <Providers>{children}</Providers>
        <PwaRegister />
      </body>
    </html>
  );
}
