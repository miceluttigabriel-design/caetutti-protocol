"use client";

import { LayoutDashboard, Users, CreditCard, Bell, MessageCircle, Clock, Settings, BookOpen, Phone, History, Menu, MapPin, LogOut } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { hasPermission } from "@/lib/session";
import type { PageKey } from "./shell";
import { PermisoKey } from "@/lib/permisos";

interface NavItem {
  id: PageKey;
  label: string;
  shortLabel?: string; // etiqueta corta para la barra inferior móvil
  icon: React.ReactNode;
  permiso: PermisoKey | null;
  group: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", shortLabel: "Inicio", icon: <LayoutDashboard className="w-5 h-5" />, permiso: "ver_dashboard", group: "Principal" },
  { id: "notificaciones", label: "Notificaciones", shortLabel: "Notifs", icon: <Bell className="w-5 h-5" />, permiso: "ver_notificaciones", group: "Notificaciones" },
  { id: "comunicaciones", label: "Comunicaciones", shortLabel: "Chats", icon: <MessageCircle className="w-5 h-5" />, permiso: "ver_comunicaciones", group: "Notificaciones" },
  { id: "recordatorios", label: "Promesas de Pago", shortLabel: "Promesas", icon: <Clock className="w-5 h-5" />, permiso: "ver_recordatorios", group: "Notificaciones" },
  { id: "contactos-dia", label: "Contactos del Día", shortLabel: "Contactos", icon: <Phone className="w-5 h-5" />, permiso: "ver_contactos_dia", group: "Notificaciones" },
  { id: "historial", label: "Historial", shortLabel: "Historial", icon: <History className="w-5 h-5" />, permiso: "ver_historial", group: "Notificaciones" },
  { id: "clientes", label: "Clientes", shortLabel: "Clientes", icon: <Users className="w-5 h-5" />, permiso: "ver_clientes", group: "Negocio" },
  { id: "cuotas", label: "Deudas", shortLabel: "Deudas", icon: <CreditCard className="w-5 h-5" />, permiso: "ver_cuotas", group: "Negocio" },
  { id: "reglas", label: "Reglas", shortLabel: "Reglas", icon: <BookOpen className="w-5 h-5" />, permiso: "ver_reglas", group: "Configuración" },
  { id: "configuracion", label: "Configuración", shortLabel: "Ajustes", icon: <Settings className="w-5 h-5" />, permiso: "ver_configuracion", group: "Configuración" },
];

// Los 4 módulos principales para la barra inferior
const PRIMARY: PageKey[] = ["dashboard", "clientes", "cuotas", "notificaciones"];

const PRIMARY_ICON: Partial<Record<PageKey, React.ReactNode>> = {
  dashboard: <LayoutDashboard className="w-5 h-5" />,
  clientes: <Users className="w-5 h-5" />,
  cuotas: <CreditCard className="w-5 h-5" />,
  notificaciones: <Bell className="w-5 h-5" />,
};

const PRIMARY_SHORT: Partial<Record<PageKey, string>> = {
  dashboard: "Inicio",
  clientes: "Clientes",
  cuotas: "Deudas",
  notificaciones: "Notifs",
};

interface MobileNavProps {
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
  user: any;
  onLogout: () => void;
  sucursalFiltro: string;
  onSucursalChange: (s: string) => void;
}

/**
 * Barra de navegación inferior (solo móvil/tablet < lg).
 * Navegación con el pulgar: 4 módulos principales + botón "Más"
 * con el resto de secciones, filtro de sucursal y cerrar sesión.
 */
export function MobileNav({ currentPage, onNavigate, user, onLogout, sucursalFiltro, onSucursalChange }: MobileNavProps) {
  const visibleItems = NAV_ITEMS.filter((item) => !item.permiso || hasPermission(user, item.permiso));
  const primary = visibleItems.filter((i) => PRIMARY.includes(i.id)).slice(0, 4);
  const rest = visibleItems.filter((i) => !primary.includes(i));
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = rest.some((i) => i.id === currentPage);
  const go = (page: PageKey) => { setMoreOpen(false); onNavigate(page); };

  const { data: sucursales } = useQuery({
    queryKey: ["sucursales"],
    queryFn: async () => {
      const r = await fetch("/api/sucursales");
      if (!r.ok) throw new Error();
      return r.json().then((d) => d.sucursales as { id: string; nombre: string; codigo?: string }[]);
    },
    staleTime: 5 * 60 * 1000,
    enabled: user.permisos?.includes("*") || user.permisos?.includes("ver_sucursales"),
  });

  const groups: Record<string, NavItem[]> = {};
  for (const item of rest) {
    if (!groups[item.group]) groups[item.group] = [];
    groups[item.group].push(item);
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden border-t border-border/40 bg-background/95 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navegación principal móvil"
    >
      <div className="grid grid-cols-5 h-16">
        {primary.map((item) => {
          const active = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`relative flex flex-col items-center justify-center gap-1 transition-colors active:bg-secondary/40 ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <span className={active ? "drop-shadow-[0_0_6px_rgba(0,255,65,0.6)]" : ""}>
                {PRIMARY_ICON[item.id]}
              </span>
              <span className="text-[10px] leading-none font-medium px-0.5 max-w-full truncate">{PRIMARY_SHORT[item.id] || item.label}</span>
              {active && <span className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-primary glow-primary" />}
            </button>
          );
        })}

        {/* Más */}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button
              className={`relative flex flex-col items-center justify-center gap-1 transition-colors active:bg-secondary/40 ${
                moreActive ? "text-primary" : "text-muted-foreground"
              }`}
              aria-label="Más secciones"
            >
              <Menu className="w-5 h-5" />
              <span className="text-[10px] leading-none font-medium">Más</span>
              {moreActive && <span className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-primary glow-primary" />}
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[75dvh] rounded-t-2xl border-primary/20 p-0 flex flex-col">
            <SheetHeader className="p-4 border-b border-border/40 text-left">
              <SheetTitle className="text-sm font-mono text-primary glow-text">
                {">"} Todas las secciones
              </SheetTitle>
              <p className="text-xs text-muted-foreground">
                {user.empresaNombre} · {user.name}
              </p>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto overscroll-contain p-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
              {/* Filtro de sucursal (mismo permiso que el topbar) */}
              {(user.permisos?.includes("*") || user.permisos?.includes("ver_sucursales")) && (
                <div className="mb-4 flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border/40 bg-secondary/40">
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                  <select
                    value={sucursalFiltro}
                    onChange={(e) => onSucursalChange(e.target.value)}
                    className="bg-transparent text-sm outline-none cursor-pointer w-full"
                    aria-label="Filtrar por sucursal"
                  >
                    <option value="__TODAS__" className="bg-background">Todas las sucursales</option>
                    {(sucursales || []).map((s) => (
                      <option key={s.id} value={s.id} className="bg-background">{s.nombre}</option>
                    ))}
                  </select>
                </div>
              )}

              {Object.entries(groups).map(([group, items]) => (
                <div key={group} className="mb-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 px-2 py-1.5 font-semibold">
                    {group}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {items.map((item) => {
                      const active = currentPage === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => go(item.id)}
                          className={`flex items-center gap-2.5 px-3 py-3 rounded-lg text-sm min-h-[48px] transition-colors ${
                            active
                              ? "bg-primary text-primary-foreground glow-primary"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                          }`}
                        >
                          <span className="shrink-0">{item.icon}</span>
                          <span className="flex-1 text-left leading-tight">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Cerrar sesión */}
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-2.5 px-3 py-3 rounded-lg text-sm text-red-400 hover:bg-red-500/10 min-h-[48px] transition-colors"
              >
                <LogOut className="w-5 h-5 shrink-0" />
                <span>Cerrar sesión</span>
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
