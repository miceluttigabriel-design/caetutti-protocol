"use client";

import { useState, useEffect } from "react";
import { signOut, useSession } from "next-auth/react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { DashboardPage } from "@/components/modules/dashboard";
import { ClientesModule } from "@/components/modules/clientes";
import { CuotasModule } from "@/components/modules/cuotas";
import { NotificacionesModule } from "@/components/modules/notificaciones";
import { ReglasModule } from "@/components/modules/reglas";
import { ComunicacionesModule } from "@/components/modules/comunicaciones";
import { RecordatoriosModule } from "@/components/modules/recordatorios";
import { ConfiguracionModule } from "@/components/modules/configuracion";
import { UsuariosModule } from "@/components/modules/usuarios";
import { AdminUsuariosModule } from "@/components/modules/admin-usuarios";
import { ImportarModule } from "@/components/modules/importar";
import { MantenimientoCuotasModule } from "@/components/modules/mantenimiento-cuotas";
import { ContactosDiaModule } from "@/components/modules/contactos-dia";
import { HistorialModule } from "@/components/modules/historial";
import { hasPermission } from "@/lib/session";
import { PermisoKey } from "@/lib/permisos";

export type PageKey =
  | "dashboard" | "clientes" | "cuotas" | "notificaciones"
  | "comunicaciones" | "recordatorios" | "reglas"
  | "configuracion"
  | "admin-usuarios" | "admin-grupos"
  | "importar" | "mantenimiento-cuotas" | "contactos-dia" | "historial";

const PAGE_PERMISO: Record<PageKey, PermisoKey | null> = {
  dashboard: "ver_dashboard",
  clientes: "ver_clientes",
  cuotas: "ver_cuotas",
  notificaciones: "ver_notificaciones",
  comunicaciones: "ver_comunicaciones",
  recordatorios: "ver_recordatorios",
  reglas: "ver_reglas",
  configuracion: "ver_configuracion",
  "admin-usuarios": "admin_usuarios",
  "admin-grupos": "admin_usuarios",
  "importar": "ver_importar",
  "mantenimiento-cuotas": "ver_mantenimiento_cuotas",
  "contactos-dia": "ver_contactos_dia",
  "historial": "ver_historial",
};

export function DashboardShell() {
  const { data: session } = useSession();
  const [page, setPage] = useState<PageKey>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sucursalFiltro, setSucursalFiltro] = useState<string>("__TODAS__");

  // Restaura sucursal seleccionada
  useEffect(() => {
    const saved = localStorage.getItem("selected_sucursal");
    if (saved) setSucursalFiltro(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem("selected_sucursal", sucursalFiltro);
  }, [sucursalFiltro]);

  const user = session?.user as any;
  if (!user) return null;

  const permisoNecesario = PAGE_PERMISO[page];
  const puedeVer = !permisoNecesario || hasPermission(user, permisoNecesario);

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar
        currentPage={page}
        onNavigate={(p) => { setPage(p); setSidebarOpen(false); }}
        user={user}
        onLogout={() => signOut({ callbackUrl: "/" })}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          user={user}
          page={page}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          sucursalFiltro={sucursalFiltro}
          onSucursalChange={setSucursalFiltro}
        />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {puedeVer ? (
            <div key={page} className="animate-fade-in">
              {renderPage(page, sucursalFiltro)}
            </div>
          ) : (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center">
                <p className="text-4xl mb-3">🔒</p>
                <h2 className="text-xl font-semibold mb-2">Sin acceso</h2>
                <p className="text-sm text-muted-foreground">
                  No tienes permiso para ver esta sección.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function renderPage(page: PageKey, sucursal: string) {
  switch (page) {
    case "dashboard": return <DashboardPage sucursal={sucursal} />;
    case "clientes": return <ClientesModule sucursal={sucursal} />;
    case "cuotas": return <CuotasModule />;
    case "notificaciones": return <NotificacionesModule sucursal={sucursal} />;
    case "comunicaciones": return <ComunicacionesModule />;
    case "recordatorios": return <RecordatoriosModule />;
    case "reglas": return <ReglasModule />;
    case "configuracion": return <ConfiguracionModule />;
    case "admin-usuarios": return <AdminUsuariosModule />;
    case "importar": return <ImportarModule />;
    case "mantenimiento-cuotas": return <MantenimientoCuotasModule />;
    case "contactos-dia": return <ContactosDiaModule />;
    case "historial": return <HistorialModule />;
    default: return <DashboardPage sucursal={sucursal} />;
  }
}
