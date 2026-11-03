import type { Metadata } from "next";
import { JetBrains_Mono, Share_Tech_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

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
  icons: { icon: "/caetutti-logo.png" },
  // Forzar no-caché para que los cambios se vean inmediatamente
  other: {
    "cache-control": "no-cache, no-store, must-revalidate",
    "pragma": "no-cache",
    "expires": "0",
  },
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
      </body>
    </html>
  );
}
