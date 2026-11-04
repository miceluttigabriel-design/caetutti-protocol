"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Edit2, Phone, MapPin, AlertTriangle, ShieldAlert, Eye, Bell, CheckCircle2, FileText } from "lucide-react";
import { fmtGs, fmtPhone, fmtRelative, fmtDateTime } from "@/lib/format";
import { toast } from "sonner";

export function ClientesModule() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const r = await fetch("/api/clientes");
      if (!r.ok) throw new Error();
      return r.json();
    },
  });

  const clientes = (data?.clientes || []).filter((c: any) => {
    const q = search.toLowerCase();
    return !q
      || c.entidad?.toLowerCase().includes(q)
      || c.codigoEntidad?.toLowerCase().includes(q)
      || c.telefono?.includes(q)
      || c.localidad?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, código, teléfono, localidad…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 glass-card"
          />
        </div>
        <Button onClick={() => setShowCreate(true)} className="glow-primary">
          <Plus className="w-4 h-4 mr-2" /> Nuevo Cliente
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="Total" value={String(clientes.length)} accent="text-primary" />
        <MiniStat label="Con teléfono" value={String(clientes.filter((c: any) => c.telefono).length)} accent="text-emerald-400" />
        <MiniStat label="Sin teléfono" value={String(clientes.filter((c: any) => !c.telefono).length)} accent="text-amber-400" />
        <MiniStat label="Judicial" value={String(clientes.filter((c: any) => c.judicial === "S").length)} accent="text-red-400" />
      </div>

      {/* === Reporte de Exclusiones INFORCONF (debajo del titular) === */}
      <ReporteExclusionesInforconf />

      {/* Table */}
      <Card className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/40 bg-secondary/30">
              <tr>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Cliente</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Teléfono</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Sucursal</th>
                <th className="text-right px-3 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Saldo</th>
                <th className="text-center px-3 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Cuotas</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Notificado</th>
                <th className="text-center px-3 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border/20">
                  <td colSpan={7} className="p-3"><Skeleton className="h-6" /></td>
                </tr>
              ))}
              {!isLoading && clientes.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-muted-foreground text-sm">No hay clientes que coincidan con la búsqueda.</td></tr>
              )}
              {!isLoading && clientes.map((c: any) => (
                <tr key={c.id} className={`border-b border-border/20 hover:bg-secondary/30 transition-colors ${c.notificado ? "opacity-50" : ""}`}>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="font-medium">{c.entidad}</p>
                        <p className="text-[10px] text-muted-foreground">{c.codigoEntidad} · {c.localidad || "—"}</p>
                      </div>
                      {c.judicial === "S" && <ShieldAlert className="w-3.5 h-3.5 text-red-400" />}
                      {c.informconf === "S" && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    {c.telefono ? (
                      <span className="flex items-center gap-1.5 text-xs">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        {fmtPhone(c.telefono)}
                      </span>
                    ) : (
                      <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-[10px]">Sin teléfono</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{c.sucursal?.nombre || "—"}</td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="font-semibold text-amber-400">{fmtGs(c.saldoTotal)}</span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Badge variant="secondary" className="text-xs">{c.cuotasPendientes}</Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    {c.notificado && c.ultimaNotificacion ? (
                      <div className="flex flex-col gap-0.5">
                        <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-[10px] w-fit">
                          <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                          Notificado
                        </Badge>
                        <span className="text-[10px] text-muted-foreground" title={fmtDateTime(c.ultimaNotificacion)}>
                          {fmtRelative(c.ultimaNotificacion)}
                        </span>
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground border-border/40 text-[10px]">
                        <Bell className="w-2.5 h-2.5 mr-1" />
                        Sin notificar
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewing(c)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(c)}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Edit dialog */}
      {editing && (
        <ClienteDialog
          cliente={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["clientes"] }); setEditing(null); }}
        />
      )}

      {/* Create dialog */}
      {showCreate && (
        <ClienteDialog
          onClose={() => setShowCreate(false)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["clientes"] }); setShowCreate(false); }}
        />
      )}

      {/* View dialog */}
      {viewing && <ClienteDetalle cliente={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <Card className="glass-card">
      <CardContent className="p-3">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className={`text-xl font-bold ${accent}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function ClienteDialog({ cliente, onClose, onSaved }: { cliente?: any; onClose: () => void; onSaved: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    codigoEntidad: cliente?.codigoEntidad || "",
    entidad: cliente?.entidad || "",
    ciEntidad: cliente?.ciEntidad || "",
    rucEntidad: cliente?.rucEntidad || "",
    localidad: cliente?.localidad || "",
    telefono: cliente?.telefono || "",
    telefonoPivot: cliente?.telefonoPivot || "",
    vendedor: cliente?.vendedor || "",
    cobrador: cliente?.cobrador || "",
    judicial: cliente?.judicial || "N",
    informconf: cliente?.informconf || "N",
  });

  // === Codeudor (solo lectura — el codeudor ya es una entidad propia en Clientes) ===
  // El registro/edición del codeudor se hace desde el módulo Notificaciones.
  const [codeudorNombre, setCodeudorNombre] = useState(cliente?.codeudorNombre || "");
  const [savingCodeudor, setSavingCodeudor] = useState(false);

  const eliminarCodeudor = async () => {
    if (!cliente) return;
    if (!confirm("¿Eliminar el codeudor de este cliente?")) return;
    setSavingCodeudor(true);
    try {
      const r = await fetch(`/api/clientes/${cliente.id}/codeudor`, { method: "DELETE" });
      if (!r.ok) throw new Error();
      setCodeudorNombre("");
      toast.success("Codeudor eliminado");
      qc.invalidateQueries({ queryKey: ["clientes"] });
    } catch {
      toast.error("Error al eliminar");
    } finally {
      setSavingCodeudor(false);
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      const url = cliente ? `/api/clientes/${cliente.id}` : "/api/clientes";
      const method = cliente ? "PUT" : "POST";
      const r = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Error");
      return r.json();
    },
    onSuccess: () => { toast.success(cliente ? "Cliente actualizado" : "Cliente creado"); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{cliente ? "Editar Cliente" : "Nuevo Cliente"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
          <Field label="Código Entidad *">
            <Input value={form.codigoEntidad} onChange={(e) => setForm({...form, codigoEntidad: e.target.value})} disabled={!!cliente} />
          </Field>
          <Field label="Nombre / Entidad *">
            <Input value={form.entidad} onChange={(e) => setForm({...form, entidad: e.target.value})} />
          </Field>
          <Field label="Cédula">
            <Input value={form.ciEntidad} onChange={(e) => setForm({...form, ciEntidad: e.target.value})} />
          </Field>
          <Field label="RUC">
            <Input value={form.rucEntidad} onChange={(e) => setForm({...form, rucEntidad: e.target.value})} />
          </Field>
          <Field label="Localidad">
            <Input value={form.localidad} onChange={(e) => setForm({...form, localidad: e.target.value})} />
          </Field>
          <Field label="Vendedor">
            <Input value={form.vendedor} onChange={(e) => setForm({...form, vendedor: e.target.value})} />
          </Field>
          <Field label="Teléfono">
            <Input value={form.telefono} onChange={(e) => setForm({...form, telefono: e.target.value})} placeholder="09XX123456" />
          </Field>
          <Field label="Teléfono Alternativo">
            <Input value={form.telefonoPivot} onChange={(e) => setForm({...form, telefonoPivot: e.target.value})} />
          </Field>
          <Field label="Judicial">
            <Select value={form.judicial} onValueChange={(v) => setForm({...form, judicial: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="N">No</SelectItem><SelectItem value="S">Sí</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Informconf">
            <Select value={form.informconf} onValueChange={(v) => setForm({...form, informconf: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="N">No</SelectItem><SelectItem value="S">Sí</SelectItem></SelectContent>
            </Select>
          </Field>
        </div>

        {/* === CODEUDOR (compacto — solo nombre de la entidad) === */}
        {codeudorNombre && (
          <div className="mt-4 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                Codeudor
              </p>
              <p className="text-sm font-medium truncate">{codeudorNombre}</p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-red-400 hover:text-red-300 shrink-0"
              onClick={eliminarCodeudor}
              disabled={savingCodeudor}
            >
              {savingCodeudor ? "Eliminando…" : "Eliminar codeudor"}
            </Button>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.codigoEntidad || !form.entidad}>
            {save.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function ClienteDetalle({ cliente, onClose }: { cliente: any; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["cliente-cuotas", cliente.id],
    queryFn: async () => {
      const r = await fetch(`/api/cuotas?cliente_id=${cliente.id}`);
      if (!r.ok) throw new Error();
      return r.json();
    },
  });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{cliente.entidad}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[65vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <DetailRow label="Código" value={cliente.codigoEntidad} />
            <DetailRow label="CI" value={cliente.ciEntidad || "—"} />
            <DetailRow label="Teléfono" value={fmtPhone(cliente.telefono)} />
            <DetailRow label="Localidad" value={cliente.localidad || "—"} />
            <DetailRow label="Vendedor" value={cliente.vendedor || "—"} />
            <DetailRow label="Saldo Total" value={fmtGs(cliente.saldoTotal)} highlight />
            <DetailRow
              label="Últ. Notificación"
              value={cliente.ultimaNotificacion ? fmtRelative(cliente.ultimaNotificacion) : "Nunca"}
              highlight={!!cliente.ultimaNotificacion}
            />
            <DetailRow
              label="Estado Notif."
              value={cliente.notificado ? "Notificado" : "Sin notificar"}
              highlight={cliente.notificado}
            />
          </div>
          {cliente.ultimaNotificacion && (
            <div className="text-[10px] text-muted-foreground -mt-1">
              Fecha exacta: {fmtDateTime(cliente.ultimaNotificacion)}
            </div>
          )}

          {/* === Sección Codeudor (debajo del titular) === */}
          {cliente.codeudorNombre && (
            <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-2">
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                Codeudor
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <DetailRow label="Nombre" value={cliente.codeudorNombre} />
                <DetailRow label="Teléfono" value={fmtPhone(cliente.codeudorTelefono)} />
                <DetailRow label="CI" value={cliente.codeudorCi || "—"} />
                <DetailRow label="Parentesco" value={cliente.codeudorParentesco || "—"} />
              </div>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Cuotas Pendientes</p>
            {isLoading ? <Skeleton className="h-20" /> : (
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {(data?.cuotas || []).map((q: any) => (
                  <div key={q.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/40 text-sm">
                    <div>
                      <p className="font-medium flex items-center gap-1.5">
                        {fmtGs(q.saldoGs)}
                        {q.montoEditado && (
                          <Badge variant="outline" className="text-[9px] py-0 px-1 text-amber-400 border-amber-500/30">
                            editado
                          </Badge>
                        )}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Vence: {new Date(q.fechaVcto).toLocaleDateString("es-PY")}
                        {q.notificado && q.ultimaNotificacion && (
                          <span className="ml-1.5 text-emerald-400" title={fmtDateTime(q.ultimaNotificacion)}>
                            · notif. {fmtRelative(q.ultimaNotificacion)}
                          </span>
                        )}
                      </p>
                    </div>
                    <Badge variant={q.diasAtrasado > 0 ? "destructive" : "secondary"}>
                      {q.diasAtrasado > 0 ? `${q.diasAtrasado}d atraso` : "por vencer"}
                    </Badge>
                  </div>
                ))}
                {!data?.cuotas?.length && <p className="text-xs text-muted-foreground py-4 text-center">Sin cuotas pendientes</p>}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between p-2 rounded bg-secondary/30">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`font-medium ${highlight ? "text-amber-400" : ""}`}>{value}</span>
    </div>
  );
}

// ============================================================
// REPORTE: EXCLUSIONES DE MOROSIDADES (INFORCONF)
// Lista titulares y codeudores marcados INFORCONF="S" sin deuda activa.
// Botón "Exportar PDF / Imprimir" para imprimir el reporte.
// ============================================================

function ReporteExclusionesInforconf() {
  const { data, isLoading } = useQuery({
    queryKey: ["inforconf-exclusiones"],
    queryFn: async () => {
      const r = await fetch("/api/inforconf/exclusiones");
      if (!r.ok) throw new Error();
      return r.json();
    },
  });

  if (isLoading) return null;
  const titulares: any[] = data?.titulares || [];
  const codeudores: any[] = data?.codeudores || [];
  const total = (data?.totalTitulares || 0) + (data?.totalCodeudores || 0);
  if (total === 0) return null;

  // === EXPORTAR / IMPRIMIR PDF ===
  const exportarPDF = () => {
    const hoy = new Date();
    const fechaStr = hoy.toLocaleDateString("es-PY") + " " + hoy.toLocaleTimeString("es-PY");

    const filasTitulares = titulares.map((t, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${t.codigoEntidad || "—"}</td>
        <td>${t.entidad || "—"}</td>
        <td>${t.ciEntidad || "—"}</td>
        <td>${t.telefono || "—"}</td>
        <td>${t.localidad || "—"}</td>
        <td>${t.sucursal || "—"}</td>
        <td>${t.vendedor || "—"}</td>
        <td>${t.judicial ? "Sí" : "No"}</td>
        <td>${t.ultimaNotificacion ? new Date(t.ultimaNotificacion).toLocaleDateString("es-PY") : "—"}</td>
      </tr>
    `).join("");

    const filasCodeudores = codeudores.map((c, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${c.titularCodigo || "—"}</td>
        <td>${c.titularEntidad || "—"}</td>
        <td>${c.codeudorNombre || "—"}</td>
        <td>${c.codeudorTelefono || "—"}</td>
        <td>${c.codeudorCi || "—"}</td>
        <td>${c.codeudorParentesco || "—"}</td>
        <td>${c.sucursal || "—"}</td>
        <td>${c.titularSinDeuda ? "Sí" : "No"}</td>
      </tr>
    `).join("");

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Exclusiones de Morosidades INFORCONF — ${fechaStr}</title>
<style>
  * { font-family: 'Liberation Sans', Arial, sans-serif; box-sizing: border-box; }
  body { margin: 24px; color: #111; font-size: 11px; }
  h1 { color: #b91c1c; font-size: 18px; margin: 0 0 4px; }
  h2 { color: #b91c1c; font-size: 14px; margin: 20px 0 8px; border-bottom: 2px solid #b91c1c; padding-bottom: 4px; }
  .meta { color: #555; font-size: 10px; margin-bottom: 16px; }
  .resumen { background: #fef3c7; border: 1px solid #fbbf24; padding: 8px 12px; border-radius: 4px; margin-bottom: 16px; font-size: 11px; }
  .resumen strong { color: #b91c1c; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: #b91c1c; color: white; padding: 6px 4px; text-align: left; font-size: 10px; text-transform: uppercase; }
  td { padding: 5px 4px; border-bottom: 1px solid #ddd; font-size: 10px; }
  tr:nth-child(even) td { background: #f9fafb; }
  .footer { margin-top: 30px; font-size: 9px; color: #888; text-align: center; border-top: 1px solid #ddd; padding-top: 8px; }
  @media print { body { margin: 12px; } }
</style>
</head>
<body>
  <h1>⚠ EXCLUSIONES DE MOROSIDADES — INFORCONF</h1>
  <div class="meta">VIZA HOME — Dpto. de Cobranzas · Emitido: ${fechaStr}</div>
  <div class="resumen">
    <strong>${titulares.length}</strong> titular(es) y <strong>${codeudores.length}</strong> codeudor(es) marcados en INFORCONF sin deuda activa.
    Verificar si fueron regularizados para quitar el flag INFORCONF.
  </div>

  <h2>TITULARES — ${titulares.length} registro(s)</h2>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Código</th><th>Cliente</th><th>CI</th><th>Teléfono</th>
        <th>Localidad</th><th>Sucursal</th><th>Vendedor</th><th>Judicial</th><th>Últ. Notif.</th>
      </tr>
    </thead>
    <tbody>${filasTitulares || '<tr><td colspan="10" style="text-align:center;padding:20px">Sin titulares.</td></tr>'}</tbody>
  </table>

  <h2>CODEUDORES — ${codeudores.length} registro(s)</h2>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Cód. Titular</th><th>Titular</th><th>Codeudor</th><th>Teléfono</th>
        <th>CI Codeudor</th><th>Parentesco</th><th>Sucursal</th><th>Titular sin deuda</th>
      </tr>
    </thead>
    <tbody>${filasCodeudores || '<tr><td colspan="9" style="text-align:center;padding:20px">Sin codeudores.</td></tr>'}</tbody>
  </table>

  <div class="footer">Caetutti Protocol — Reporte de Exclusiones INFORCONF · Generado automáticamente</div>
  <script>window.onload = () => { setTimeout(() => window.print(), 300); };</script>
</body>
</html>`;

    const w = window.open("", "_blank");
    if (!w) {
      toast.error("El navegador bloqueó la ventana. Permití pop-ups para este sitio.");
      return;
    }
    w.document.write(html);
    w.document.close();
  };

  return (
    <Card className="glass-card border-amber-500/40 bg-amber-500/5">
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <div>
              <p className="text-sm font-semibold text-amber-400">
                Exclusiones INFORCONF: {titulares.length} titular(es) + {codeudores.length} codeudor(es)
              </p>
              <p className="text-[10px] text-muted-foreground">
                Marcados en INFORCONF sin deuda activa. Verificar para quitar el flag y excluir de morosidades.
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={exportarPDF}
            className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10">
            <FileText className="w-3.5 h-3.5 mr-1" />
            Exportar PDF / Imprimir
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
