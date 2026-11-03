"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Target } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function ObjetivosModule() {
  const [editing, setEditing] = useState<any | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["objetivos"],
    queryFn: async () => {
      const r = await fetch("/api/objetivos-dinamicos");
      if (!r.ok) throw new Error();
      return r.json();
    },
  });

  return (
    <div className="space-y-4">
      <Card className="glass-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">📈 Objetivos Dinámicos</p>
            <p className="text-xs text-muted-foreground">Define metas de % de pendiente por sucursal y mes</p>
          </div>
          <Button onClick={() => setEditing({})} className="glow-primary">
            <Plus className="w-4 h-4 mr-1" /> Nuevo Objetivo
          </Button>
        </div>
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        {!isLoading && (data?.objetivos || []).map((o: any) => (
          <ObjetivoCard key={o.id} obj={o} onEdit={() => setEditing(o)} />
        ))}
        {!isLoading && !data?.objetivos?.length && (
          <Card className="glass-card p-8 text-center sm:col-span-2 lg:col-span-3">
            <Target className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">No hay objetivos configurados.</p>
          </Card>
        )}
      </div>

      {editing && <ObjetivoDialog obj={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ObjetivoCard({ obj, onEdit }: { obj: any; onEdit: () => void }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/objetivos-dinamicos?id=${obj.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["objetivos"] }); toast.success("Eliminado"); },
  });

  const mesLabel = obj.mesesAtras === 0 ? "Mes actual" : obj.mesesAtras === 1 ? "Mes anterior" : `Hace ${obj.mesesAtras} meses`;

  return (
    <Card className="glass-card p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-semibold">{obj.descripcion}</p>
          <p className="text-xs text-muted-foreground">{mesLabel} · {obj.sucursal?.nombre || "Todas"}</p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}><Edit2 className="w-3.5 h-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del.mutate()}><Trash2 className="w-3.5 h-3.5" /></Button>
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-primary">{obj.porcentaje}%</span>
        <span className="text-xs text-muted-foreground">máx. pendiente</span>
      </div>
    </Card>
  );
}

function ObjetivoDialog({ obj, onClose }: { obj: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    descripcion: obj.descripcion || "",
    mesesAtras: obj.mesesAtras ?? 0,
    porcentaje: obj.porcentaje ?? 7,
    orden: obj.orden ?? 0,
  });

  const save = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/objetivos-dinamicos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["objetivos"] }); toast.success("Objetivo guardado"); onClose(); },
    onError: () => toast.error("Error al guardar"),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{obj.id ? "Editar Objetivo" : "Nuevo Objetivo"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Descripción</Label>
            <Input value={form.descripcion} onChange={(e) => setForm({...form, descripcion: e.target.value})} placeholder="Cobranza mes actual" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Meses atrás</Label>
              <Input type="number" value={form.mesesAtras} onChange={(e) => setForm({...form, mesesAtras: Number(e.target.value)})} />
            </div>
            <div>
              <Label className="text-xs">% Máximo</Label>
              <Input type="number" value={form.porcentaje} onChange={(e) => setForm({...form, porcentaje: Number(e.target.value)})} />
            </div>
            <div>
              <Label className="text-xs">Orden</Label>
              <Input type="number" value={form.orden} onChange={(e) => setForm({...form, orden: Number(e.target.value)})} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.descripcion}>{save.isPending ? "Guardando…" : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
