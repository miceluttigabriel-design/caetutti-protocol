"use client";

import { Menu, MapPin, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { fmtRelative } from "@/lib/format";

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: "Dashboard", subtitle: "Resumen general de cobranzas" },
  importar: { title: "Importar Datos", subtitle: "Carga masiva desde Excel o JSON" },
  clientes: { title: "Clientes", subtitle: "Gestión de deudores y codeudores" },
  cuotas: { title: "Deudas", subtitle: "Listado de deudas pendientes y cobradas" },
  "mantenimiento-cuotas": { title: "Mantenimiento de Deudas", subtitle: "Operaciones masivas sobre deudas" },
  notificaciones: { title: "Notificaciones", subtitle: "Envío de mensajes WhatsApp" },
  comunicaciones: { title: "Comunicaciones", subtitle: "Chat bidireccional con IA" },
  recordatorios: { title: "Promesas de Pago", subtitle: "Compromisos de pago pendientes (generados por IA o manuales)" },
  "contactos-dia": { title: "Contactos del Día", subtitle: "Productividad por cobrador" },
  historial: { title: "Historial", subtitle: "Registro de notificaciones enviadas" },
  reglas: { title: "Reglas de Notificación", subtitle: "Motor de mensajería automática" },
  configuracion: { title: "Configuración", subtitle: "Ajustes del sistema y WhatsApp" },
  "admin-usuarios": { title: "Usuarios y Grupos", subtitle: "Administración de accesos" },
  "admin-grupos": { title: "Grupos", subtitle: "Grupos y permisos" },
};

interface TopbarProps {
  user: any;
  page: string;
  onToggleSidebar: () => void;
  sucursalFiltro: string;
  onSucursalChange: (s: string) => void;
}

export function Topbar({ user, page, onToggleSidebar, sucursalFiltro, onSucursalChange }: TopbarProps) {
  const { data, refetch, isFetching } = useQuery({
    queryKey: ["sucursales"],
    queryFn: async () => {
      const r = await fetch("/api/sucursales");
      if (!r.ok) throw new Error();
      return r.json().then((d) => d.sucursales as { id: string; nombre: string; codigo?: string }[]);
    },
    staleTime: 5 * 60 * 1000,
  });

  const meta = PAGE_TITLES[page] || { title: "CobranzasFlow", subtitle: "" };

  return (
    <header
      className="sticky top-0 z-20 glass border-b border-border/40"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex items-center justify-between px-3 sm:px-4 lg:px-6 py-2.5 sm:py-3 gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-10 w-10 shrink-0"
            onClick={onToggleSidebar}
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold leading-tight truncate">{meta.title}</h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground truncate hidden sm:block">{meta.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Sucursal selector — only show if user has ver_sucursales */}
          {user.permisos?.includes("*") || user.permisos?.includes("ver_sucursales") ? (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/40 bg-secondary/40">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
              <select
                value={sucursalFiltro}
                onChange={(e) => onSucursalChange(e.target.value)}
                className="bg-transparent text-sm outline-none cursor-pointer min-w-[140px]"
              >
                <option value="__TODAS__" className="bg-background">Todas las sucursales</option>
                {data?.map((s) => (
                  <option key={s.id} value={s.id} className="bg-background">{s.nombre}</option>
                ))}
              </select>
            </div>
          ) : null}

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Actualizar"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>

          <div className="hidden md:block text-right">
            <p className="text-xs font-medium">{user.name}</p>
            <p className="text-[10px] text-muted-foreground">
              {user.rol === "admin" ? "👑 Admin" : "👤 Usuario"}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
