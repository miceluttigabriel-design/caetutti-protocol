"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Filter, RefreshCw, CheckCircle2, Clock, Wrench } from "lucide-react";
import { fmtGs, fmtDate } from "@/lib/format";
import { toast } from "sonner";

export function MantenimientoCuotasModule() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({
    sucursal: "__TODAS__",
    estado: "pendiente",
    dias_min: "",
    dias_max: "",
    fecha_desde: "",
    fecha_hasta: "",
    search: "",
  });
  const [appliedFilters, setAppliedFilters] = useState<any>(null);
  const [showCodeudor, setShowCodeudor] = useState(false);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["mant-cuotas", appliedFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(appliedFilters || {}).forEach(([k, v]) => {
        if (v) params.set(k, String(v));
      });
      const r = await fetch(`/api/mantenimiento-cuotas?${params}`);
      if (!r.ok) throw new Error();
      return r.json();
    },
    enabled: !!appliedFilters,
  });

  const bulk = useMutation({
    mutationFn: async (action: string, codeudorId?: string) => {
      const r = await fetch("/api/mantenimiento-cuotas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, filters: appliedFilters, codeudorId }),
      });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: (data: any) => {
      toast.success(`${data.affected} deudas actualizadas`);
      qc.invalidateQueries({ queryKey: ["mant-cuotas"] });
      qc.invalidateQueries({ queryKey: ["cuotas"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => toast.error("Error en operación masiva"),
  });

  const buscar = () => {
    setAppliedFilters({ ...filters });
  };

  const limpiar = () => {
    setFilters({
      sucursal: "__TODAS__", estado: "pendiente",
      dias_min: "", dias_max: "", fecha_desde: "", fecha_hasta: "", search: "",
    });
    setAppliedFilters(null);
  };

  const cuotas = data?.cuotas || [];
  const totalSaldo = cuotas.reduce((s: number, q: any) => s + q.saldoGs, 0);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card className="glass-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-primary" />
          <p className="font-semibold text-sm">Filtros de Búsqueda</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Estado</Label>
            <select value={filters.estado} onChange={(e) => setFilters({...filters, estado: e.target.value})}
              className="w-full glass-card rounded-lg px-3 py-2 text-sm">
              <option value="">Todos</option>
              <option value="pendiente">Pendientes</option>
              <option value="cobrada">Cobradas</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Días mín</Label>
            <Input type="number" value={filters.dias_min} onChange={(e) => setFilters({...filters, dias_min: e.target.value})} placeholder="0" />
          </div>
          <div>
            <Label className="text-xs">Días máx</Label>
            <Input type="number" value={filters.dias_max} onChange={(e) => setFilters({...filters, dias_max: e.target.value})} placeholder="999" />
          </div>
          <div>
            <Label className="text-xs">Venc. desde</Label>
            <Input type="date" value={filters.fecha_desde} onChange={(e) => setFilters({...filters, fecha_desde: e.target.value})} />
          </div>
          <div>
            <Label className="text-xs">Venc. hasta</Label>
            <Input type="date" value={filters.fecha_hasta} onChange={(e) => setFilters({...filters, fecha_hasta: e.target.value})} />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={filters.search} onChange={(e) => setFilters({...filters, search: e.target.value})}
                placeholder="Cliente, código, descripción…" className="pl-9" />
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <Button onClick={buscar} className="glow-primary">
            <Search className="w-3.5 h-3.5 mr-1" /> Buscar
          </Button>
          <Button variant="outline" onClick={limpiar}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Limpiar
          </Button>
        </div>
      </Card>

      {/* Stats + bulk actions */}
      {appliedFilters && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card className="glass-card p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Encontradas</p>
              <p className="text-xl font-bold">{data?.total || 0}</p>
            </Card>
            <Card className="glass-card p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Saldo Total</p>
              <p className="text-xl font-bold text-amber-400">{fmtGs(totalSaldo)}</p>
            </Card>
            <Card className="glass-card p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Cargando</p>
              <p className="text-xl font-bold">{isFetching ? "⏳" : "✓"}</p>
            </Card>
          </div>

          <Card className="glass-card p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Acciones para TODAS las deudas filtradas:</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => bulk.mutate("marcar_cobradas")} className="text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Marcar Cobradas
              </Button>
              <Button variant="outline" size="sm" onClick={() => bulk.mutate("marcar_pendientes")} className="text-amber-400">
                <Clock className="w-3.5 h-3.5 mr-1" /> Marcar Pendientes
              </Button>
            </div>
          </Card>

          {/* Tabla */}
          <Card className="glass-card overflow-hidden">
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/40 bg-secondary/30 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs uppercase text-muted-foreground">Cliente</th>
                    <th className="text-left px-3 py-2 text-xs uppercase text-muted-foreground">Venc.</th>
                    <th className="text-right px-3 py-2 text-xs uppercase text-muted-foreground">Saldo</th>
                    <th className="text-center px-3 py-2 text-xs uppercase text-muted-foreground">Días</th>
                    <th className="text-center px-3 py-2 text-xs uppercase text-muted-foreground">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td colSpan={5} className="p-3"><Skeleton className="h-6" /></td></tr>
                  ))}
                  {cuotas.map((q: any) => (
                    <tr key={q.id} className="border-b border-border/20 hover:bg-secondary/30">
                      <td className="px-3 py-2">
                        <p className="font-medium text-xs">{q.cliente?.entidad}</p>
                        <p className="text-[10px] text-muted-foreground">{q.cliente?.codigoEntidad} · {q.sucursal?.nombre}</p>
                      </td>
                      <td className="px-3 py-2 text-xs">{fmtDate(q.fechaVcto)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-xs">{fmtGs(q.saldoGs)}</td>
                      <td className="px-3 py-2 text-center text-xs">
                        <span className={q.diasAtrasado > 30 ? "text-red-400" : q.diasAtrasado > 0 ? "text-amber-400" : "text-emerald-400"}>
                          {q.diasAtrasado}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant={q.estado === "cobrada" ? "default" : "outline"} className="text-[10px]">
                          {q.estado === "cobrada" ? "✓" : "⏰"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {!isLoading && cuotas.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-8 text-muted-foreground text-sm">No se encontraron deudas con los filtros aplicados</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {!appliedFilters && (
        <Card className="glass-card p-8 text-center">
          <Wrench className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">Configura los filtros y haz clic en "Buscar" para ver cuotas y aplicar acciones masivas.</p>
        </Card>
      )}
    </div>
  );
}
