"use client";

import { LayoutDashboard, Users, CreditCard, Bell, MessageCircle, Clock, Settings, BookOpen, LogOut, X, ChevronRight, Wrench, Phone, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { hasPermission } from "@/lib/session";
import type { PageKey } from "./shell";
import { PermisoKey } from "@/lib/permisos";

interface NavItem {
  id: PageKey;
  label: string;
  icon: React.ReactNode;
  permiso: PermisoKey | null;
  group: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" />, permiso: "ver_dashboard", group: "Principal" },
  { id: "notificaciones", label: "Notificaciones", icon: <Bell className="w-4 h-4" />, permiso: "ver_notificaciones", group: "Notificaciones" },
  { id: "comunicaciones", label: "Comunicaciones", icon: <MessageCircle className="w-4 h-4" />, permiso: "ver_comunicaciones", group: "Notificaciones" },
  { id: "recordatorios", label: "Promesas de Pago", icon: <Clock className="w-4 h-4" />, permiso: "ver_recordatorios", group: "Notificaciones" },
  { id: "contactos-dia", label: "Contactos del Día", icon: <Phone className="w-4 h-4" />, permiso: "ver_contactos_dia", group: "Notificaciones" },
  { id: "historial", label: "Historial", icon: <History className="w-4 h-4" />, permiso: "ver_historial", group: "Notificaciones" },
  { id: "clientes", label: "Clientes", icon: <Users className="w-4 h-4" />, permiso: "ver_clientes", group: "Negocio" },
  { id: "cuotas", label: "Deudas", icon: <CreditCard className="w-4 h-4" />, permiso: "ver_cuotas", group: "Negocio" },
  { id: "mantenimiento-cuotas", label: "Mantenimiento", icon: <Wrench className="w-4 h-4" />, permiso: "ver_mantenimiento_cuotas", group: "Negocio" },
  { id: "reglas", label: "Reglas", icon: <BookOpen className="w-4 h-4" />, permiso: "ver_reglas", group: "Configuración" },
  { id: "configuracion", label: "Configuración", icon: <Settings className="w-4 h-4" />, permiso: "ver_configuracion", group: "Configuración" },
];

interface SidebarProps {
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
  user: any;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ currentPage, onNavigate, user, onLogout, isOpen, onClose }: SidebarProps) {
  const visibleItems = NAV_ITEMS.filter((item) => !item.permiso || hasPermission(user, item.permiso));

  // Group items
  const groups: Record<string, NavItem[]> = {};
  for (const item of visibleItems) {
    if (!groups[item.group]) groups[item.group] = [];
    groups[item.group].push(item);
  }

  return (
    <aside
      className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 shrink-0 border-r border-sidebar-border bg-sidebar flex flex-col transition-transform duration-300 ${
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      }`}
    >
      {/* Logo */}
      <div className="p-3 border-b border-sidebar-border flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <img src="/caetutti-logo.png" alt="Caetutti Dynamics" className="w-10 h-10 object-contain shrink-0" />
          <div className="min-w-0">
            <p className="font-bold text-xs leading-tight tracking-wide" style={{ color: "#c0c0c0" }}>CAETUTTI</p>
            <p className="text-[9px] leading-tight" style={{ color: "#00c4ff" }}>DYNAMICS</p>
            <p className="text-[9px] text-primary/50 font-mono leading-tight mt-0.5">{"// PROTOCOL"}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-7 w-7 shrink-0"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Plan badge */}
      <div className="px-4 pt-3 pb-2">
        <div className="rounded-lg border border-sidebar-border bg-secondary/50 p-2.5">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Empresa</p>
              <p className="text-xs font-semibold truncate">{user.empresaNombre}</p>
            </div>
            <Badge variant="outline" className="ml-2 text-[10px] capitalize shrink-0">
              {user.empresaPlan}
            </Badge>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {Object.entries(groups).map(([group, items]) => (
          <div key={group} className="mb-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 px-2 py-1.5 font-semibold">
              {group}
            </p>
            <div className="space-y-0.5">
              {items.map((item) => {
                const active = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer group ${
                      active
                        ? "bg-primary text-primary-foreground glow-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                    }`}
                  >
                    <span className={`shrink-0 ${active ? "" : "text-muted-foreground group-hover:text-foreground"}`}>
                      {item.icon}
                    </span>
                    <span className="flex-1 text-left">{item.label}</span>
                    {active && <ChevronRight className="w-3 h-3 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User card */}
      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/60 transition-colors">
          <Avatar className="w-9 h-9">
            <AvatarFallback className={`text-xs font-semibold ${user.rol === "admin" ? "bg-violet-500/20 text-violet-300" : "bg-primary/20 text-primary"}`}>
              {user.name?.slice(0, 2).toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">
              {user.rol === "admin" ? "👑 Admin" : user.login}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={onLogout}
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
