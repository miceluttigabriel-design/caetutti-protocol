"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, CheckCircle2, Clock, AlertTriangle, Eye, Edit2, DollarSign } from "lucide-react";
import { fmtGs, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export function CuotasModule() {
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"todas" | "pendiente" | "cobrada">("pendiente");
  const [viewing, setViewing] = useState<any | null>(null);
  const [editing, setEditing] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["cuotas", filtroEstado],
    queryFn: async () => {
      const r = await fetch(`/api/cuotas?${filtroEstado !== "todas" ? `estado=${filtroEstado}` : ""}`);
      if (!r.ok) throw new Error();
      return r.json();
    },
  });

  const cuotas = (data?.cuotas || []).filter((q: any) => {
    const s = search.toLowerCase();
    return !s
      || q.cliente?.entidad?.toLowerCase().includes(s)
      || q.cliente?.codigoEntidad?.toLowerCase().includes(s)
      || q.descripcion?.toLowerCase().includes(s);
  });

  const totalPendiente = cuotas.reduce((s: number, q: any) => s + (q.estado === "pendiente" ? q.saldoGs : 0), 0);
  const vencidas = cuotas.filter((q: any) => q.diasAtrasado > 0).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, código, descripción…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 glass-card"
          />
        </div>
        <div className="grid grid-cols-3 sm:flex gap-1 p-1 rounded-lg glass-card">
          {(["pendiente", "cobrada", "todas"] as const).map((e) => (
            <Button
              key={e}
              variant={filtroEstado === e ? "default" : "ghost"}
              size="sm"
              onClick={() => setFiltroEstado(e)}
              className="text-xs capitalize"
            >
              {e === "todas" ? "Todas" : e === "pendiente" ? "Pendientes" : "Cobradas"}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="glass-card p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Deudas</p>
          <p className="text-xl font-bold">{cuotas.length}</p>
        </Card>
        <Card className="glass-card p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Vencidas</p>
          <p className="text-xl font-bold text-red-400">{vencidas}</p>
        </Card>
        <Card className="glass-card p-3 col-span-2 sm:col-span-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Saldo Pendiente</p>
          <p className="text-xl font-bold text-amber-400">{fmtGs(totalPendiente)}</p>
        </Card>
      </div>

      <Card className="glass-card overflow-hidden">
        {/* === Vista celular: tarjetas (< 768px) === */}
        <div className="md:hidden divide-y divide-border/20">
          {isLoading && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-3"><Skeleton className="h-20" /></div>
          ))}
          {!isLoading && cuotas.length === 0 && (
            <p className="text-center py-10 px-4 text-muted-foreground text-sm">No hay deudas que mostrar.</p>
          )}
          {!isLoading && cuotas.slice(0, 200).map((q: any) => (
            <CuotaCard key={q.id} cuota={q} onView={() => setViewing(q)} onEdit={() => setEditing(q)} />
          ))}
        </div>

        {/* === Vista tablet/escritorio: tabla (≥ 768px) === */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/40 bg-secondary/30">
              <tr>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Cliente</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Vencimiento</th>
                <th className="text-right px-3 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Saldo</th>
                <th className="text-center px-3 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Días</th>
                <th className="text-center px-3 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Estado</th>
                <th className="text-center px-3 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Acción</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}><td colSpan={6} className="p-3"><Skeleton className="h-6" /></td></tr>
              ))}
              {!isLoading && cuotas.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-muted-foreground text-sm">No hay deudas que mostrar.</td></tr>
              )}
              {!isLoading && cuotas.slice(0, 200).map((q: any) => (
                <CuotaRow key={q.id} cuota={q} onView={() => setViewing(q)} onEdit={() => setEditing(q)} />
              ))}
            </tbody>
          </table>
        </div>
        {cuotas.length > 200 && (
          <div className="text-center py-2 text-xs text-muted-foreground border-t border-border/20">
            Mostrando 200 de {cuotas.length} — usa el buscador para filtrar
          </div>
        )}
      </Card>

      {viewing && <CuotaDetalle cuota={viewing} onClose={() => setViewing(null)} />}
      {editing && <CuotaEdit cuota={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function CuotaRow({ cuota, onView, onEdit }: { cuota: any; onView: () => void; onEdit: () => void }) {
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/cuotas", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cuota.id, estado: cuota.estado === "pendiente" ? "cobrada" : "pendiente" }),
      });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cuotas"] }); toast.success("Estado actualizado"); },
    onError: () => toast.error("Error al actualizar"),
  });

  const diasColor =
    cuota.diasAtrasado > 60 ? "text-red-400" :
    cuota.diasAtrasado > 30 ? "text-orange-400" :
    cuota.diasAtrasado > 0 ? "text-amber-400" : "text-emerald-400";

  return (
    <tr className="border-b border-border/20 hover:bg-secondary/30 transition-colors">
      <td className="px-3 py-2.5">
        <p className="font-medium">{cuota.cliente?.entidad}</p>
        <p className="text-[10px] text-muted-foreground">{cuota.cliente?.codigoEntidad} · {cuota.descripcion || "—"}</p>
      </td>
      <td className="px-3 py-2.5 text-xs">
        {fmtDate(cuota.fechaVcto)}
        <p className="text-[10px] text-muted-foreground">{cuota.sucursal?.nombre}</p>
      </td>
      <td className="px-3 py-2.5 text-right">
        <span className="font-semibold">{fmtGs(cuota.saldoGs)}</span>
        {cuota.montoEditado && (
          <Badge variant="outline" className="ml-1 text-[9px] py-0 px-1 text-amber-400 border-amber-500/30 align-middle">
            editado
          </Badge>
        )}
      </td>
      <td className={`px-3 py-2.5 text-center font-semibold ${diasColor}`}>
        {cuota.diasAtrasado > 0 ? `+${cuota.diasAtrasado}d` : `${cuota.diasAtrasado}d`}
      </td>
      <td className="px-3 py-2.5 text-center">
        {cuota.estado === "cobrada" ? (
          <Badge className="bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20"><CheckCircle2 className="w-3 h-3 mr-1" /> Cobrada</Badge>
        ) : (
          <Badge variant="outline" className="text-amber-400 border-amber-500/30"><Clock className="w-3 h-3 mr-1" /> Pendiente</Badge>
        )}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center justify-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onView} title="Ver detalle">
            <Eye className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-400 hover:text-amber-300" onClick={onEdit} title="Editar monto y fecha">
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          {cuota.estado === "pendiente" ? (
            <Button
              variant="ghost" size="icon" className="h-7 w-7 text-emerald-400 hover:text-emerald-300"
              onClick={() => toggle.mutate()} title="Marcar cobrada"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
            </Button>
          ) : (
            <Button
              variant="ghost" size="icon" className="h-7 w-7 text-amber-400"
              onClick={() => toggle.mutate()} title="Volver a pendiente"
            >
              <Clock className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

// Tarjeta para celular (misma lógica que la fila de la tabla)
function CuotaCard({ cuota, onView, onEdit }: { cuota: any; onView: () => void; onEdit: () => void }) {
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/cuotas", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cuota.id, estado: cuota.estado === "pendiente" ? "cobrada" : "pendiente" }),
      });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cuotas"] }); toast.success("Estado actualizado"); },
    onError: () => toast.error("Error al actualizar"),
  });

  const diasColor =
    cuota.diasAtrasado > 60 ? "text-red-400" :
    cuota.diasAtrasado > 30 ? "text-orange-400" :
    cuota.diasAtrasado > 0 ? "text-amber-400" : "text-emerald-400";

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold leading-tight break-words">{cuota.cliente?.entidad}</p>
          <p className="text-[11px] text-muted-foreground">{cuota.cliente?.codigoEntidad} · {cuota.descripcion || "—"}</p>
          <p className="text-[11px] text-muted-foreground">
            Vence {fmtDate(cuota.fechaVcto)}{cuota.sucursal?.nombre ? ` · ${cuota.sucursal.nombre}` : ""}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-bold text-amber-400">{fmtGs(cuota.saldoGs)}</p>
          <p className={`text-xs font-semibold ${diasColor}`}>
            {cuota.diasAtrasado > 0 ? `+${cuota.diasAtrasado}d` : `${cuota.diasAtrasado}d`}
          </p>
          {cuota.montoEditado && (
            <Badge variant="outline" className="text-[9px] py-0 px-1 text-amber-400 border-amber-500/30">editado</Badge>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        {cuota.estado === "cobrada" ? (
          <Badge className="bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20"><CheckCircle2 className="w-3 h-3 mr-1" /> Cobrada</Badge>
        ) : (
          <Badge variant="outline" className="text-amber-400 border-amber-500/30"><Clock className="w-3 h-3 mr-1" /> Pendiente</Badge>
        )}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-10 px-3" onClick={onView} aria-label="Ver detalle">
            <Eye className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-10 px-3 text-amber-400" onClick={onEdit} aria-label="Editar monto y fecha">
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button
            variant="outline" size="sm"
            className={`h-10 px-3 ${cuota.estado === "pendiente" ? "text-emerald-400" : "text-amber-400"}`}
            onClick={() => toggle.mutate()} disabled={toggle.isPending}
            aria-label={cuota.estado === "pendiente" ? "Marcar cobrada" : "Volver a pendiente"}
          >
            {cuota.estado === "pendiente" ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CuotaDetalle({ cuota, onClose }: { cuota: any; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Detalle de Deuda</DialogTitle></DialogHeader>
        <div className="space-y-2 text-sm">
          <Row label="Cliente" value={cuota.cliente?.entidad} />
          <Row label="Código" value={cuota.cliente?.codigoEntidad} />
          <Row label="Teléfono" value={cuota.cliente?.telefono || "—"} />
          <Row label="Sucursal" value={cuota.sucursal?.nombre || "—"} />
          <Row label="Vendedor" value={cuota.vendedor || "—"} />
          <Row label="Descripción" value={cuota.descripcion || "—"} />
          <Row label="Emisión" value={fmtDate(cuota.fechaEmision)} />
          <Row label="Vencimiento" value={fmtDate(cuota.fechaVcto)} />
          <Row label="Días de atraso" value={`${cuota.diasAtrasado} días`} />
          <Row label="Saldo Gs" value={fmtGs(cuota.saldoGs)} highlight />
          {cuota.montoEditado && (
            <div className="text-[10px] text-amber-400 italic">
              ⚠ Monto editado manualmente — no se pisará al re-importar
            </div>
          )}
          <Row label="Estado" value={cuota.estado} />
          <Row label="Notificada" value={cuota.notificado ? "Sí" : "No"} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// === EDITAR MONTO Y FECHA ===
function CuotaEdit({ cuota, onClose }: { cuota: any; onClose: () => void }) {
  const qc = useQueryClient();

  // Formato fecha YYYY-MM-DD para input type=date
  const fechaVctoStr = cuota.fechaVcto
    ? new Date(cuota.fechaVcto).toISOString().split("T")[0]
    : "";

  const [form, setForm] = useState({
    saldoGs: String(cuota.saldoGs || 0),
    saldoGuarani: String(cuota.saldoGuarani || 0),
    saldoDolar: String(cuota.saldoDolar || 0),
    fechaVcto: fechaVctoStr,
    descripcion: cuota.descripcion || "",
    vendedor: cuota.vendedor || "",
  });

  const save = useMutation({
    mutationFn: async () => {
      const body: any = { id: cuota.id };
      if (form.saldoGs !== "") body.saldoGs = Number(form.saldoGs);
      if (form.saldoGuarani !== "") body.saldoGuarani = Number(form.saldoGuarani);
      if (form.saldoDolar !== "") body.saldoDolar = Number(form.saldoDolar);
      if (form.fechaVcto) body.fechaVcto = form.fechaVcto;
      if (form.descripcion !== cuota.descripcion) body.descripcion = form.descripcion;
      if (form.vendedor !== cuota.vendedor) body.vendedor = form.vendedor;

      const r = await fetch("/api/cuotas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Error al guardar");
      return r.json();
    },
    onSuccess: () => {
      toast.success("Monto editado — se preservará al re-importar");
      qc.invalidateQueries({ queryKey: ["cuotas"] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["notifs"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message || "Error"),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-amber-400" />
            Editar Deuda
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-1 mb-2">
          <p className="text-sm font-medium">{cuota.cliente?.entidad}</p>
          <p className="text-[10px] text-muted-foreground">
            Código: {cuota.cliente?.codigoEntidad} · Sucursal: {cuota.sucursal?.nombre || "—"}
          </p>
        </div>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Saldo en Gs *</Label>
            <Input
              type="number"
              value={form.saldoGs}
              onChange={(e) => setForm({ ...form, saldoGs: e.target.value })}
              placeholder="0"
            />
          </div>
          {/* === Vista previa del interés calculado === */}
          {form.saldoGs && form.fechaVcto && (
            <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs space-y-1">
              <p className="text-amber-400 font-semibold mb-1">📊 Cálculo automático al guardar:</p>
              {(() => {
                const saldo = Number(form.saldoGs) || 0;
                const vcto = new Date(form.fechaVcto);
                const hoy = new Date();
                hoy.setHours(0, 0, 0, 0);
                vcto.setHours(0, 0, 0, 0);
                const dias = Math.max(0, Math.floor((hoy.getTime() - vcto.getTime()) / (1000 * 60 * 60 * 24)));
                const interes = Math.round(saldo * 0.001 * dias);
                const total = saldo + interes;
                return (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Días de atraso:</span>
                      <span className="font-medium">{dias} días</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Interés acumulado (0.10% diario):</span>
                      <span className="font-medium text-orange-400">₲ {interes.toLocaleString("es-PY")}</span>
                    </div>
                    <div className="flex justify-between border-t border-amber-500/20 pt-1 mt-1">
                      <span className="text-amber-400 font-semibold">Total con interés:</span>
                      <span className="font-bold text-amber-400">₲ {total.toLocaleString("es-PY")}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Saldo Guaraní</Label>
              <Input
                type="number"
                value={form.saldoGuarani}
                onChange={(e) => setForm({ ...form, saldoGuarani: e.target.value })}
                placeholder="0"
              />
            </div>
            <div>
              <Label className="text-xs">Saldo Dólar</Label>
              <Input
                type="number"
                value={form.saldoDolar}
                onChange={(e) => setForm({ ...form, saldoDolar: e.target.value })}
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Fecha de Vencimiento</Label>
            <Input
              type="date"
              value={form.fechaVcto}
              onChange={(e) => setForm({ ...form, fechaVcto: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Descripción</Label>
            <Input
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Descripción opcional"
            />
          </div>
          <div>
            <Label className="text-xs">Vendedor</Label>
            <Input
              value={form.vendedor}
              onChange={(e) => setForm({ ...form, vendedor: e.target.value })}
              placeholder="Vendedor"
            />
          </div>
        </div>
        <div className="text-[10px] text-amber-400 italic mt-2 p-2 rounded bg-amber-500/5 border border-amber-500/20">
          ⚠ Al guardar, el monto se marca como <strong>editado</strong> y NO se pisará al re-importar el Excel.
          El sistema calcula automáticamente los días de atraso y el interés diario (0.10%) sobre el monto que pongas.
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !form.saldoGs}
            className="glow-primary"
          >
            {save.isPending ? "Guardando…" : "Guardar Cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between p-2 rounded bg-secondary/30">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`font-medium ${highlight ? "text-amber-400" : ""}`}>{value}</span>
    </div>
  );
}
