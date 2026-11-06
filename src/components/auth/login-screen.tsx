"use client";

import { useState, useEffect, useRef } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, LogIn, Terminal, Shield, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export function LoginScreen() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [bootLines, setBootLines] = useState<string[]>([]);
  const [bootDone, setBootDone] = useState(false);
  const bootIndex = useRef(0);

  // Boot sequence
  useEffect(() => {
    const lines = [
      "[ OK ] Initializing Caetutti Protocol v1.0...",
      "[ OK ] Loading kernel modules...",
      "[ OK ] Mounting encrypted filesystems...",
      "[ OK ] Starting network services...",
      "[ OK ] WhatsApp Meta API: standby",
      "[ OK ] AI Engine (Gemini): standby",
      "[ OK ] AI Engine (Ollama): standby",
      "[ OK ] Debt database: 352 records loaded",
      "[ WARN ] Unauthorized access is logged and prosecuted",
      "[ OK ] System ready. Awaiting authentication...",
      "",
    ];
    const interval = setInterval(() => {
      if (bootIndex.current < lines.length) {
        setBootLines((prev) => [...prev, lines[bootIndex.current]]);
        bootIndex.current++;
      } else {
        clearInterval(interval);
        setBootDone(true);
      }
    }, 180);
    return () => clearInterval(interval);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!login.trim() || !password) {
      toast.error("Credenciales requeridas");
      return;
    }
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        login: login.trim(),
        password,
        redirect: false,
      });
      if (res?.error) {
        toast.error(res.error || "Authentication failed");
      } else {
        toast.success("Access granted");
        window.location.reload();
      }
    } catch (e: any) {
      toast.error(e.message || "Connection error");
    } finally {
      setLoading(false);
    }
  }

  function quickFill(u: string, p: string) {
    setLogin(u);
    setPassword(p);
  }

  return (
    <div className="min-h-dvh flex flicker matrix-bg">
      {/* Left: terminal boot + branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden border-r border-primary/20">
        {/* Glow blobs */}
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

        {/* Logo de Caetutti Dynamics arriba a la izquierda + nombre del sistema */}
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-20 h-20 flex items-center justify-center glow-primary rounded-lg bg-black/40 border border-primary/20 p-1.5">
              <img src="/caetutti-logo.png" alt="Caetutti Dynamics" className="w-full h-full object-contain" style={{ filter: "drop-shadow(0 0 8px rgba(0, 255, 65, 0.3))" }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#c0c0c0" }}>CAETUTTI</h1>
              <p className="text-sm font-bold" style={{ color: "#00c4ff" }}>DYNAMICS</p>
              <p className="text-[10px] text-primary/60 font-mono mt-1">{"// PROTOCOL v1.0"}</p>
            </div>
          </div>

          <h2 className="text-4xl font-bold leading-tight mb-3 glow-text">
            Control your debt<br />
            <span className="text-primary glitch">collection protocol</span>
          </h2>
          <p className="text-foreground/60 text-base max-w-md font-mono">
            Automated WhatsApp notifications, AI-powered conversation analysis,
            and intelligent payment commitment detection.
          </p>
        </div>

        {/* Boot terminal */}
        <div className="relative z-10 bg-black/60 border border-primary/20 rounded p-4 font-mono text-xs max-w-md">
          <div className="flex items-center gap-2 mb-2 text-primary/60">
            <Terminal className="w-3 h-3" />
            <span>system_boot.log</span>
          </div>
          <div className="space-y-0.5 h-48 overflow-hidden">
            {bootLines.map((line, i) => (
              <div
                key={i}
                className={`boot-line ${(line || "").includes("[ OK ]") ? "text-primary" : (line || "").includes("[ WARN ]") ? "text-yellow-500" : "text-foreground/40"}`}
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                {line || ""}
              </div>
            ))}
            {bootDone && <div className="text-primary cursor">$ _</div>}
          </div>
        </div>

        {/* Feature pills */}
        <div className="relative z-10 grid grid-cols-2 gap-3 max-w-md">
          <FeaturePill icon=">" label="WhatsApp Cloud API" />
          <FeaturePill icon=">" label="AI: Gemini + Ollama" />
          <FeaturePill icon=">" label="Multi-tenant" />
          <FeaturePill icon=">" label="Auto payment detection" />
        </div>
      </div>

      {/* Right: login form */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        {/* Mobile logo */}
        <div className="absolute top-8 left-1/2 -translate-x-1/2 lg:hidden flex items-center gap-3">
          <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-black/40 border border-primary/20 p-1">
            <img src="/caetutti-logo.png" alt="Caetutti Dynamics" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: "#c0c0c0" }}>CAETUTTI</h1>
            <p className="text-[11px] font-bold" style={{ color: "#00c4ff" }}>DYNAMICS</p>
          </div>
        </div>

        <div className="w-full max-w-md glass-card border-primary/20 p-8 relative">
          {/* Corner accents */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-primary" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-primary" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-primary" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-primary" />

          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2 text-primary/60 font-mono text-xs">
              <Shield className="w-3 h-3" />
              <span>SECURE LOGIN REQUIRED</span>
            </div>
            <h2 className="text-2xl font-bold text-primary glow-text font-mono">AUTHENTICATE</h2>
            <p className="text-xs text-foreground/50 font-mono mt-1">
              {">"} Enter credentials to access the system
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login" className="text-xs font-mono text-primary/70">
                {">"} USERNAME
              </Label>
              <Input
                id="login"
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="admin"
                disabled={loading}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                className="font-mono bg-black/40 border-primary/20 text-primary placeholder:text-primary/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-mono text-primary/70">
                {">"} PASSWORD
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                autoComplete="current-password"
                enterKeyHint="go"
                className="font-mono bg-black/40 border-primary/20 text-primary placeholder:text-primary/30"
              />
            </div>

            <Button
              type="submit"
              className="w-full glow-primary font-mono tracking-wider"
              disabled={loading}
              size="lg"
              variant="default"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> AUTHENTICATING...</>
              ) : (
                <><LogIn className="w-4 h-4 mr-2" /> EXECUTE LOGIN</>
              )}
            </Button>
          </form>

          {/* Acceso rápido Admin */}
          <div className="mt-6 pt-6 border-t border-primary/10">
            <p className="text-[10px] font-mono text-primary/50 mb-2 text-center">
              {">"} ADMIN ACCESS — click to autofill:
            </p>
            <div className="grid grid-cols-1 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => quickFill("admin", "admin123")}
                className="text-xs font-mono border-primary/30 text-primary hover:bg-primary/10"
              >
                <span className="text-primary/60 mr-1">$</span> admin
              </Button>
            </div>
          </div>

          {/* Warning footer */}
          <div className="mt-6 flex items-start gap-2 text-[10px] text-yellow-500/70 font-mono">
            <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
            <span>
              Unauthorized access will be logged. IP addresses are tracked and
              may be reported to authorities.
            </span>
          </div>

          <p className="text-center text-[10px] text-primary/40 font-mono mt-4">
            v1.0 · CAETUTTI PROTOCOL · © 2025
          </p>
        </div>
      </div>
    </div>
  );
}

function FeaturePill({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="glass-card rounded p-3 border-primary/15">
      <div className="flex items-center gap-2">
        <span className="text-primary font-mono text-sm">{icon}</span>
        <span className="text-xs font-mono text-foreground/70">{label}</span>
      </div>
    </div>
  );
}
