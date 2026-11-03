"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, RefreshCw, History, Send, CheckCircle2, XCircle } from "lucide-react";
import { fmtDateTime, fmtPhone } from "@/lib/format";

export function HistorialModule() {
  const [filters, setFilters] = useState({
    desde: "",
    hasta: "",
    search: "",
  });
  const [applied, setApplied] = useState<any>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["historial", applied],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (applied?.desde) params.set("desde", applied.desde);
      if (applied?.hasta) params.set("hasta", applied.hasta);
      if (applied?.search) params.set("search", applied.search);
      const r = await fetch(`/api/historial?${params}`);
      if (!r.ok) throw new Error();
      return r.json();
    },
    enabled: !!applied,
  });

  const notifs = data?.notificaciones || [];

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card className="glass-card p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase">Desde</label>
            <Input type="date" value={filters.desde} onChange={(e) => setFilters({...filters, desde: e.target.value})} className="w-36" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase">Hasta</label>
            <Input type="date" value={filters.hasta} onChange={(e) => setFilters({...filters, hasta: e.target.value})} className="w-36" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] text-muted-foreground uppercase">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={filters.search} onChange={(e) => setFilters({...filters, search: e.target.value})}
                placeholder="Cliente, teléfono, mensaje…" className="pl-9" />
            </div>
          </div>
          <Button onClick={() => setApplied({...filters})} className="glow-primary">
            <Search className="w-3.5 h-3.5 mr-1" /> Buscar
          </Button>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Actualizar
          </Button>
        </div>
      </Card>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total enviados" value={data.total} icon={<Send className="w-4 h-4" />} color="text-primary" />
          <StatCard label="Enviadas" value={data.porEstado.enviada || 0} icon={<Send className="w-4 h-4" />} color="text-sky-400" />
          <StatCard label="Recibidas" value={data.porEstado.recibida || 0} icon={<CheckCircle2 className="w-4 h-4" />} color="text-emerald-400" />
          <StatCard label="Fallidas" value={data.porEstado.fallida || 0} icon={<XCircle className="w-4 h-4" />} color="text-red-400" />
        </div>
      )}

      {/* Tabla */}
      <Card className="glass-card overflow-hidden">
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/40 bg-secondary/30 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 text-xs uppercase text-muted-foreground">Fecha</th>
                <th className="text-left px-3 py-2 text-xs uppercase text-muted-foreground">Cliente</th>
                <th className="text-left px-3 py-2 text-xs uppercase text-muted-foreground">Teléfono</th>
                <th className="text-left px-3 py-2 text-xs uppercase text-muted-foreground">Mensaje</th>
                <th className="text-left px-3 py-2 text-xs uppercase text-muted-foreground">Enviado por</th>
                <th className="text-center px-3 py-2 text-xs uppercase text-muted-foreground">Estado</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={6} className="p-3"><Skeleton className="h-6" /></td></tr>
              ))}
              {!isLoading && notifs.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                  {applied ? "No hay notificaciones en el rango seleccionado." : "Configura filtros y busca para ver el historial."}
                </td></tr>
              )}
              {notifs.map((n: any) => (
                <tr key={n.id} className="border-b border-border/20 hover:bg-secondary/30">
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmtDateTime(n.createdAt)}</td>
                  <td className="px-3 py-2">
                    <p className="text-xs font-medium">{n.cliente?.entidad || "—"}</p>
                    <p className="text-[10px] text-muted-foreground">{n.cliente?.sucursal?.nombre}</p>
                  </td>
                  <td className="px-3 py-2 text-xs">{fmtPhone(n.telefono)}</td>
                  <td className="px-3 py-2 text-xs max-w-xs truncate text-muted-foreground">{n.mensaje}</td>
                  <td className="px-3 py-2 text-xs">{n.usuario?.nombre || "—"}</td>
                  <td className="px-3 py-2 text-center">
                    <Badge variant={
                      n.estado === "leida" ? "default" :
                      n.estado === "recibida" ? "secondary" :
                      n.estado === "fallida" ? "destructive" : "outline"
                    } className="text-[10px]">
                      {n.estado}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <Card className="glass-card p-3 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg bg-secondary/60 flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-xl font-bold">{value}</p>
        <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
      </div>
    </Card>
  );
}
