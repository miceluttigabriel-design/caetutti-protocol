"use client";

import { useEffect, useState } from "react";
import { Download, Share, X, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa_install_dismissed_at";
const DISMISS_DAYS = 7;

function wasDismissed(): boolean {
  try {
    const v = localStorage.getItem(DISMISS_KEY);
    if (!v) return false;
    const diff = Date.now() - Number(v);
    return diff < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    // iOS Safari
    (window.navigator as any).standalone === true
  );
}

/**
 * Banner de instalación de la PWA.
 * Android/Chrome: usa beforeinstallprompt (instalación nativa).
 * iOS Safari: muestra instrucciones de "Agregar a pantalla de inicio".
 * En modo standalone (app ya instalada) no se muestra nunca.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasDismissed()) return;

    const ua = window.navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document);
    setIsIos(ios);

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      if (!wasDismissed()) setShowBanner(true);
    };
    const onInstalled = () => setShowBanner(false);

    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);

    // iOS no dispara beforeinstallprompt → banner propio (solo Safari, no in-app browsers)
    if (ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)) {
      const t = setTimeout(() => setShowBanner(true), 2500);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onBip);
        window.removeEventListener("appinstalled", onInstalled);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    setShowBanner(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
  }

  async function handleInstall() {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setShowBanner(false);
      return;
    }
    if (isIos) {
      setShowIosHelp(true);
      return;
    }
    // Navegador sin beforeinstallprompt: menú manual
    setShowIosHelp(true);
  }

  return (
    <>
      {showBanner && (
        <div className="fixed bottom-20 lg:bottom-4 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-40 animate-fade-in">
          <div className="glass-card border-primary/30 p-3.5 relative shadow-xl">
            <button
              onClick={dismiss}
              className="absolute top-2 right-2 text-muted-foreground hover:text-foreground p-1"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-start gap-3 pr-5">
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-primary glow-text font-mono">
                  {">"} Instalar como app
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {isIos
                    ? "Agregá Caetutti Protocol a tu pantalla de inicio."
                    : "Instalá Caetutti Protocol en tu dispositivo."}
                </p>
                <Button
                  size="sm"
                  className="mt-2.5 h-8 glow-primary font-mono text-xs"
                  onClick={handleInstall}
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  INSTALAR
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog open={showIosHelp} onOpenChange={setShowIosHelp}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-primary font-mono">
              {">"} Agregar a pantalla de inicio
            </DialogTitle>
            <DialogDescription>
              Seguí estos pasos para tener Caetutti Protocol como una app en tu celular:
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">1</span>
              <span>
                Tocá el botón <Share className="w-4 h-4 inline text-primary" />{" "}
                <strong>Compartir</strong> {isIos ? "de Safari" : "del navegador"} (abajo en el centro en iPhone).
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">2</span>
              <span>Elegí <strong>“Agregar a pantalla de inicio”</strong>.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">3</span>
              <span>
                Confirmá con <strong>“Agregar”</strong>. El ícono verde de Caetutti queda en tu celular y se abre como app (sin barra del navegador).
              </span>
            </li>
          </ol>
          <p className="text-xs text-muted-foreground">
            Tus datos viven en el servidor: entrás desde el celular o la computadora con la misma cuenta y ves exactamente lo mismo.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
