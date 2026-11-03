"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, DollarSign } from "lucide-react";
import { fmtGs } from "@/lib/format";
import { toast } from "sonner";

export function VentasModule() {
  const [showAdd, setShowAdd] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["ventas"],
    queryFn: async () => {
      const r = await fetch("/api/ventas-mes");
      if (!r.ok) throw new Error();
      return r.json();
    },
  });

  const ventas = (data?.ventas || []).slice().sort((a: any, b: any) => b.anhoMes.localeCompare(a.anhoMes));

  return (
    <div className="space-y-4">
      <Card className="glass-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">💰 Ventas por Mes</p>
            <p className="text-xs text-muted-foreground">Registra el total vendido mensual para calcular objetivos de cobranza</p>
          </div>
          <Button onClick={() => setShowAdd(true)} className="glow-primary">
            <Plus className="w-4 h-4 mr-1" /> Registrar Mes
          </Button>
        </div>
      </Card>

      <Card className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border/40 bg-secondary/30">
            <tr>
              <th className="text-left px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground font-medium">Mes</th>
              <th className="text-left px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground font-medium">Sucursal</th>
              <th className="text-right px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground font-medium">Total Vendido</th>
              <th className="text-center px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}><td colSpan={4} className="p-3"><Skeleton className="h-6" /></td></tr>
            ))}
            {!isLoading && ventas.map((v: any) => <VentaRow key={v.id} venta={v} />)}
            {!isLoading && ventas.length === 0 && (
              <tr><td colSpan={4} className="text-center py-10 text-sm text-muted-foreground">No hay ventas registradas.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      {showAdd && <AddVentaDialog onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function VentaRow({ venta }: { venta: any }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/ventas-mes?id=${venta.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ventas"] }); toast.success("Eliminado"); },
  });

  return (
    <tr className="border-b border-border/20 hover:bg-secondary/30">
      <td className="px-3 py-2.5 font-medium">{venta.anhoMes}</td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">{venta.sucursal?.nombre || "Todas"}</td>
      <td className="px-3 py-2.5 text-right font-semibold text-emerald-400">{fmtGs(venta.totalVendido)}</td>
      <td className="px-3 py-2.5 text-center">
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del.mutate()}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </td>
    </tr>
  );
}

function AddVentaDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [anhoMes, setAnhoMes] = useState(new Date().toISOString().slice(0, 7));
  const [total, setTotal] = useState("");
  const [sucursalId, setSucursalId] = useState("");

  const { data: sucursales } = useQuery({
    queryKey: ["sucursales"],
    queryFn: async () => {
      const r = await fetch("/api/sucursales");
      return r.json();
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/ventas-mes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anhoMes, totalVendido: Number(total), sucursalId: sucursalId || undefined }),
      });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ventas"] }); toast.success("Venta registrada"); onClose(); },
    onError: () => toast.error("Error al guardar"),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Registrar Venta Mensual</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Mes</Label>
            <Input type="month" value={anhoMes} onChange={(e) => setAnhoMes(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Total Vendido (₲)</Label>
            <Input type="number" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="50000000" />
          </div>
          <div>
            <Label className="text-xs">Sucursal (vacío = todas)</Label>
            <select value={sucursalId} onChange={(e) => setSucursalId(e.target.value)} className="w-full glass-card rounded-lg px-3 py-2 text-sm">
              <option value="">Todas las sucursales</option>
              {(sucursales?.sucursales || []).map((s: any) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !anhoMes || !total}>
            {save.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
