"use client";

import { useSession } from "next-auth/react";
import { LoginScreen } from "@/components/auth/login-screen";
import { DashboardShell } from "@/components/dashboard/shell";

export default function Home() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Cargando CobranzasFlow…</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return <DashboardShell />;
}
