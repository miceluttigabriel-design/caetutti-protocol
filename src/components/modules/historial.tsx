"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, RefreshCw, History, Send, CheckCircle2, XCircle, Filter } from "lucide-react";
import { fmtDateTime, fmtPhone } from "@/lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function HistorialModule() {
  const [filters, setFilters] = useState({
    desde: "",
    hasta: "",
    search: "",
    estado: "todas", // todas | enviada | fallida | recibida | leida
  });
  const [applied, setApplied] = useState<any>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["historial", applied],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (applied?.desde) params.set("desde", applied.desde);
      if (applied?.hasta) params.set("hasta", applied.hasta);
      if (applied?.search) params.set("search", applied.search);
      if (applied?.estado && applied.estado !== "todas") params.set("estado", applied.estado);
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
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-end gap-2">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase">Desde</label>
            <Input type="date" value={filters.desde} onChange={(e) => setFilters({...filters, desde: e.target.value})} className="w-full sm:w-36" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase">Hasta</label>
            <Input type="date" value={filters.hasta} onChange={(e) => setFilters({...filters, hasta: e.target.value})} className="w-full sm:w-36" />
          </div>
          <div className="col-span-2 sm:flex-1 sm:min-w-[200px]">
            <label className="text-[10px] text-muted-foreground uppercase">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={filters.search} onChange={(e) => setFilters({...filters, search: e.target.value})}
                placeholder="Cliente, teléfono, mensaje…" className="pl-9" />
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="text-[10px] text-muted-foreground uppercase">Estado</label>
            <Select value={filters.estado} onValueChange={(v) => setFilters({...filters, estado: v})}>
              <SelectTrigger className="w-full sm:w-40">
                <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todos</SelectItem>
                <SelectItem value="enviada">Enviadas</SelectItem>
                <SelectItem value="fallida">Fallidas</SelectItem>
                <SelectItem value="recibida">Recibidas</SelectItem>
                <SelectItem value="leida">Leídas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setApplied({...filters})} className="glow-primary col-span-1">
            <Search className="w-3.5 h-3.5 mr-1" /> Buscar
          </Button>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="col-span-1">
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
        {/* === Vista celular: tarjetas (< 768px) === */}
        <div className="md:hidden divide-y divide-border/20">
          {isLoading && Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-3"><Skeleton className="h-16" /></div>
          ))}
          {!isLoading && notifs.length === 0 && (
            <p className="text-center py-10 px-4 text-muted-foreground text-sm">
              {applied ? "No hay notificaciones en el rango seleccionado." : "Configura filtros y busca para ver el historial."}
            </p>
          )}
          {notifs.map((n: any) => (
            <div key={n.id} className="p-3 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight break-words">{n.cliente?.entidad || "—"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {fmtPhone(n.telefono)}{n.cliente?.sucursal?.nombre ? ` · ${n.cliente.sucursal.nombre}` : ""}
                  </p>
                </div>
                <Badge variant={
                  n.estado === "leida" ? "default" :
                  n.estado === "recibida" ? "secondary" :
                  n.estado === "fallida" ? "destructive" : "outline"
                } className="text-[10px] shrink-0">
                  {n.estado}
                </Badge>
              </div>
              {n.mensaje && <p className="text-xs text-muted-foreground line-clamp-2 break-words">{n.mensaje}</p>}
              {n.respuesta && <p className="text-[11px] text-red-400/80 break-words">{n.respuesta}</p>}
              <p className="text-[10px] text-muted-foreground/70">
                {fmtDateTime(n.createdAt)}{n.usuario?.nombre ? ` · ${n.usuario.nombre}` : ""}
              </p>
            </div>
          ))}
        </div>

        {/* === Vista tablet/escritorio: tabla (≥ 768px) === */}
        <div className="hidden md:block overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/40 bg-secondary/30 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 text-xs uppercase text-muted-foreground">Fecha</th>
                <th className="text-left px-3 py-2 text-xs uppercase text-muted-foreground">Cliente</th>
                <th className="text-left px-3 py-2 text-xs uppercase text-muted-foreground">Teléfono</th>
                <th className="text-left px-3 py-2 text-xs uppercase text-muted-foreground">Mensaje</th>
                <th className="text-left px-3 py-2 text-xs uppercase text-muted-foreground">Enviado por</th>
                <th className="text-center px-3 py-2 text-xs uppercase text-muted-foreground">Estado</th>
                <th className="text-left px-3 py-2 text-xs uppercase text-muted-foreground">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={7} className="p-3"><Skeleton className="h-6" /></td></tr>
              ))}
              {!isLoading && notifs.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-muted-foreground text-sm">
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
                  <td className="px-3 py-2 text-xs text-red-400/80 max-w-[180px] truncate" title={n.respuesta || ""}>
                    {n.respuesta || "—"}
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
