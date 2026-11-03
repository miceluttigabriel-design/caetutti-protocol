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
import { Search, Edit2, Phone, MapPin, AlertTriangle, ShieldAlert, Eye, Bell, CheckCircle2, Building2 } from "lucide-react";
import { fmtGs, fmtPhone, fmtRelative, fmtDateTime } from "@/lib/format";
import { toast } from "sonner";

const POR_PAGINA = 50;

export function ClientesModule() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [pagina, setPagina] = useState(1);
  const [sucursalSel, setSucursalSel] = useState<string>("todas");
  const [editing, setEditing] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);

  // Lista de sucursales para el filtro (cache largo — no cambia casi nunca)
  const { data: sucData } = useQuery({
    queryKey: ["sucursales"],
    queryFn: async () => {
      const r = await fetch("/api/sucursales");
      if (!r.ok) throw new Error();
      return r.json();
    },
    staleTime: 30 * 60 * 1000,
  });
  const sucursales = sucData?.sucursales || [];

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const r = await fetch("/api/clientes");
      if (!r.ok) throw new Error();
      return r.json();
    },
    // ⚡ Cache de 5 minutos: cambiar de pestaña NO recarga todo de nuevo.
    //    Si otro módulo guarda cambios, invalida el cache y se refresca solo.
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Filtro por sucursal + búsqueda
  const clientes = (data?.clientes || []).filter((c: any) => {
    if (sucursalSel !== "todas" && c.sucursalId !== sucursalSel) return false;
    const q = search.toLowerCase();
    return !q
      || c.entidad?.toLowerCase().includes(q)
      || c.codigoEntidad?.toLowerCase().includes(q)
      || c.telefono?.includes(q)
      || c.localidad?.toLowerCase().includes(q);
  });

  // ⚡ Paginación del lado del cliente: la BD ya respondió todo,
  //    solo dibujamos 50 filas por página para que el navegador vuele.
  const totalPaginas = Math.max(1, Math.ceil(clientes.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = clientes.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, código, teléfono, localidad…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPagina(1); }}
            className="pl-9 glass-card"
          />
        </div>
        {/* Filtro por sucursal */}
        <Select value={sucursalSel} onValueChange={(v) => { setSucursalSel(v); setPagina(1); }}>
          <SelectTrigger className="w-full sm:w-52 glass-card">
            <Building2 className="w-3.5 h-3.5 mr-1.5 text-primary" />
            <SelectValue placeholder="Todas las sucursales" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las sucursales</SelectItem>
            {sucursales.map((s: any) => (
              <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isFetching && !isLoading && (
          <span className="self-center text-xs text-muted-foreground animate-pulse">actualizando…</span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="Total" value={String(clientes.length)} accent="text-primary" />
        <MiniStat label="Con teléfono" value={String(clientes.filter((c: any) => c.telefono).length)} accent="text-emerald-400" />
        <MiniStat label="Sin teléfono" value={String(clientes.filter((c: any) => !c.telefono).length)} accent="text-amber-400" />
        <MiniStat label="Judicial" value={String(clientes.filter((c: any) => c.judicial === "S").length)} accent="text-red-400" />
      </div>

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
              {!isLoading && visibles.map((c: any) => (
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

        {/* ⚡ Paginador */}
        {!isLoading && clientes.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-3 py-2 border-t border-border/40 bg-secondary/20">
            <p className="text-xs text-muted-foreground">
              Mostrando {(paginaActual - 1) * POR_PAGINA + 1}–{Math.min(paginaActual * POR_PAGINA, clientes.length)} de {clientes.length} clientes
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 text-xs px-2" disabled={paginaActual <= 1} onClick={() => setPagina(paginaActual - 1)}>
                ‹ Anterior
              </Button>
              <span className="text-xs text-muted-foreground px-2">
                Página {paginaActual} de {totalPaginas}
              </span>
              <Button variant="outline" size="sm" className="h-7 text-xs px-2" disabled={paginaActual >= totalPaginas} onClick={() => setPagina(paginaActual + 1)}>
                Siguiente ›
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Edit dialog */}
      {editing && (
        <ClienteDialog
          cliente={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["clientes"] }); setEditing(null); }}
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

  // === Codeudor (sección separada abajo del titular) ===
  const [codeudor, setCodeudor] = useState({
    codeudorNombre: cliente?.codeudorNombre || "",
    codeudorTelefono: cliente?.codeudorTelefono || "",
    codeudorCi: cliente?.codeudorCi || "",
    codeudorParentesco: cliente?.codeudorParentesco || "",
  });
  const [savingCodeudor, setSavingCodeudor] = useState(false);

  const guardarCodeudor = async () => {
    if (!cliente) return;
    // Solo el nombre es obligatorio — el teléfono puede quedar vacío
    if (!codeudor.codeudorNombre) {
      toast.error("El nombre del codeudor es obligatorio");
      return;
    }
    setSavingCodeudor(true);
    try {
      const r = await fetch(`/api/clientes/${cliente.id}/codeudor`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(codeudor),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Error");
      toast.success(
        codeudor.codeudorTelefono
          ? "Codeudor guardado correctamente"
          : "Codeudor guardado sin teléfono — podés editarlo después"
      );
      // Actualizar el cliente local para que muestre el botón "Eliminar"
      Object.assign(cliente, codeudor);
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["notifs"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingCodeudor(false);
    }
  };

  const eliminarCodeudor = async () => {
    if (!cliente) return;
    if (!confirm("¿Eliminar el codeudor de este cliente?")) return;
    setSavingCodeudor(true);
    try {
      const r = await fetch(`/api/clientes/${cliente.id}/codeudor`, { method: "DELETE" });
      if (!r.ok) throw new Error();
      setCodeudor({ codeudorNombre: "", codeudorTelefono: "", codeudorCi: "", codeudorParentesco: "" });
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
      // Solo edición: el alta de clientes se hace automáticamente
      // al registrar un codeudor desde la pestaña Notificaciones.
      const r = await fetch(`/api/clientes/${cliente.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Error");
      return r.json();
    },
    onSuccess: () => { toast.success("Cliente actualizado"); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Cliente</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
          <Field label="Código Entidad">
            <Input value={form.codigoEntidad} onChange={(e) => setForm({...form, codigoEntidad: e.target.value})} disabled />
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

        {/* === SECCIÓN CODEUDOR (abajo del titular) === */}
        {cliente && (
          <div className="mt-4 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                Codeudor
              </p>
              {codeudor.codeudorNombre && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs text-red-400 hover:text-red-300"
                  onClick={eliminarCodeudor}
                  disabled={savingCodeudor}
                >
                  Eliminar codeudor
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre del Codeudor">
                <Input
                  value={codeudor.codeudorNombre}
                  onChange={(e) => setCodeudor({...codeudor, codeudorNombre: e.target.value})}
                  placeholder="Nombre completo"
                />
              </Field>
              <Field label="Teléfono del Codeudor (opcional)">
                <Input
                  value={codeudor.codeudorTelefono}
                  onChange={(e) => setCodeudor({...codeudor, codeudorTelefono: e.target.value})}
                  placeholder="09XX123456"
                />
              </Field>
              <Field label="CI del Codeudor">
                <Input
                  value={codeudor.codeudorCi}
                  onChange={(e) => setCodeudor({...codeudor, codeudorCi: e.target.value})}
                  placeholder="Cédula"
                />
              </Field>
              <Field label="Parentesco">
                <Input
                  value={codeudor.codeudorParentesco}
                  onChange={(e) => setCodeudor({...codeudor, codeudorParentesco: e.target.value})}
                  placeholder="Esposo/a, Padre, Hijo/a..."
                />
              </Field>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
              onClick={guardarCodeudor}
              disabled={savingCodeudor || !codeudor.codeudorNombre}
            >
              {savingCodeudor ? "Guardando…" : "Guardar Codeudor"}
            </Button>
            <p className="text-[10px] text-muted-foreground">
              El codeudor se guarda de forma permanente. No se borra al re-importar el Excel.
              El teléfono es opcional — si lo borrás y guardás, el codeudor se mantiene sin teléfono.
              Solo se elimina si hacés clic en "Eliminar codeudor".
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.entidad}>
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
