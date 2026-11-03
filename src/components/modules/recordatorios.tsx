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
import { Textarea } from "@/components/ui/textarea";
import { Clock, CheckCircle2, Plus, Calendar } from "lucide-react";
import { fmtDate, fmtPhone } from "@/lib/format";
import { toast } from "sonner";

export function RecordatoriosModule() {
  const [filtro, setFiltro] = useState<"pendiente" | "completado" | "vencido">("pendiente");
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["recordatorios", filtro],
    queryFn: async () => {
      const r = await fetch(`/api/recordatorios?estado=${filtro}`);
      if (!r.ok) throw new Error();
      return r.json();
    },
  });

  const records = data?.recordatorios || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1 p-1 rounded-lg glass-card">
          {(["pendiente", "completado", "vencido"] as const).map((e) => (
            <Button key={e} variant={filtro === e ? "default" : "ghost"} size="sm" onClick={() => setFiltro(e)} className="text-xs capitalize">
              {e === "pendiente" ? "⏰ Pendientes" : e === "completado" ? "✓ Completados" : "⚠ Vencidos"}
            </Button>
          ))}
        </div>
        <Button onClick={() => setShowCreate(true)} className="glow-primary">
          <Plus className="w-4 h-4 mr-1" /> Nueva Promesa de Pago
        </Button>
      </div>

      <div className="space-y-2">
        {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        {!isLoading && records.length === 0 && (
          <Card className="glass-card p-8 text-center">
            <Clock className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">No hay promesas de pago {filtro}s.</p>
          </Card>
        )}
        {!isLoading && records.map((r: any) => <RecordatorioCard key={r.id} recordatorio={r} />)}
      </div>

      {showCreate && <CreateRecordatorioDialog onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function RecordatorioCard({ recordatorio }: { recordatorio: any }) {
  const qc = useQueryClient();
  const completar = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/recordatorios", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: recordatorio.id, estado: "completado" }),
      });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recordatorios"] }); toast.success("Promesa de pago completada"); },
  });

  const vencido = new Date(recordatorio.fechaCompromiso) < new Date() && recordatorio.estado === "pendiente";

  return (
    <Card className="glass-card p-3">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
          vencido ? "bg-red-500/15 text-red-400" :
          recordatorio.estado === "completado" ? "bg-emerald-500/15 text-emerald-400" :
          "bg-amber-500/15 text-amber-400"
        }`}>
          {recordatorio.estado === "completado" ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold">{recordatorio.cliente?.entidad}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {fmtDate(recordatorio.fechaCompromiso)}
            </span>
            <span>·</span>
            <span>{fmtPhone(recordatorio.cliente?.telefono)}</span>
            {recordatorio.descripcion && <><span>·</span><span className="italic">"{recordatorio.descripcion}"</span></>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {vencido && <Badge variant="destructive" className="text-[10px]">Vencido</Badge>}
          {recordatorio.estado === "pendiente" && (
            <Button size="sm" variant="outline" onClick={() => completar.mutate()} disabled={completar.isPending} className="h-7 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Completar
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function CreateRecordatorioDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [clienteId, setClienteId] = useState("");
  const [fecha, setFecha] = useState("");
  const [desc, setDesc] = useState("");

  const { data: clientesData } = useQuery({
    queryKey: ["clientes-for-rec"],
    queryFn: async () => {
      const r = await fetch("/api/clientes");
      if (!r.ok) throw new Error();
      return r.json();
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/recordatorios", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId, fechaCompromiso: fecha, descripcion: desc }),
      });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recordatorios"] }); toast.success("Promesa de pago creada"); onClose(); },
    onError: () => toast.error("Error al crear"),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nueva Promesa de Pago</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Cliente</Label>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="w-full glass-card rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Selecciona un cliente…</option>
              {(clientesData?.clientes || []).map((c: any) => (
                <option key={c.id} value={c.id}>{c.entidad} ({c.codigoEntidad})</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Fecha de compromiso</Label>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Descripción (opcional)</Label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="Ej: Pago parcial de ₲ 500.000" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending || !clienteId || !fecha}>
            {create.isPending ? "Guardando…" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
