"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Eye, RefreshCw, Phone, AlertTriangle, UserPlus, User, Search, Trash2, ShieldCheck, Edit2, DollarSign } from "lucide-react";
import { fmtGs, fmtPhone, diasEstado, fmtRelative, fmtDateTime, fmtDate } from "@/lib/format";
import { toast } from "sonner";

export function NotificacionesModule({ sucursal }: { sucursal: string }) {
  const [ocultarNotificados, setOcultarNotificados] = useState(false);
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<any | null>(null);
  const [viewingModo, setViewingModo] = useState<"cliente" | "codeudor">("cliente");
  const [editingCodeudor, setEditingCodeudor] = useState<any | null>(null);
  // Pestaña activa: "titulares" (clientes) o "codeudores" (gestión aparte)
  const [tab, setTab] = useState<"titulares" | "codeudores">("titulares");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["notifs", sucursal, ocultarNotificados],
    queryFn: async () => {
      const r = await fetch(`/api/notificaciones?sucursal=${encodeURIComponent(sucursal)}&ocultar_notificados=${ocultarNotificados}`);
      if (!r.ok) throw new Error();
      return r.json();
    },
  });

  const items: any[] = data?.clientes || [];
  const filtered = items.filter((c) => {
    const q = search.toLowerCase();
    return !q || c.entidad?.toLowerCase().includes(q) || c.telefono?.includes(q)
      || (c.codeudor?.nombre?.toLowerCase().includes(q));
  });

  const totalPendiente = filtered.reduce((s, c) => s + (c.totalGs || 0), 0);
  const conTelefono = filtered.filter((c) => c.telefono).length;
  const sinTelefono = filtered.length - conTelefono;
  const conCodeudor = filtered.filter((c) => c.codeudor).length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Pestañas: Titulares / Codeudores */}
        <div className="flex gap-1 p-1 rounded-lg bg-secondary/40 border border-border/40">
          <button
            onClick={() => setTab("titulares")}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              tab === "titulares"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <User className="w-3 h-3 inline mr-1" />
            Titulares
          </button>
          <button
            onClick={() => setTab("codeudores")}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              tab === "codeudores"
                ? "bg-violet-500 text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UserPlus className="w-3 h-3 inline mr-1" />
            Codeudores
          </button>
        </div>

        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} /> Actualizar
        </Button>
        <div className="flex items-center gap-2 ml-auto text-sm">
          <Switch id="hide-notif" checked={ocultarNotificados} onCheckedChange={setOcultarNotificados} />
          <label htmlFor="hide-notif" className="text-xs cursor-pointer">Ocultar notificados</label>
        </div>
      </div>

      <div className="relative">
        <Input
          placeholder="Buscar por cliente, teléfono o codeudor…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="glass-card"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="glass-card p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
          <p className="text-xl font-bold">{filtered.length}</p>
        </Card>
        <Card className="glass-card p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Sin teléfono</p>
          <p className="text-xl font-bold text-amber-400">{sinTelefono}</p>
        </Card>
        <Card className="glass-card p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Con codeudor</p>
          <p className="text-xl font-bold text-violet-400">{conCodeudor}</p>
        </Card>
        <Card className="glass-card p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total a cobrar</p>
          <p className="text-xl font-bold text-amber-400">{fmtGs(totalPendiente)}</p>
        </Card>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {isLoading && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        {!isLoading && filtered.length === 0 && (
          <Card className="glass-card p-8 text-center">
            <p className="text-muted-foreground text-sm">
              {tab === "codeudores"
                ? "No hay codeudores registrados para los filtros seleccionados."
                : "No hay clientes con cuotas pendientes para los filtros seleccionados."}
            </p>
          </Card>
        )}
        {/* === PESTAÑA TITULARES: lista de clientes (sin la fila de codeudor debajo) === */}
        {!isLoading && tab === "titulares" && filtered.slice(0, 100).map((c) => (
          <NotifCard
            key={c.id}
            cliente={c}
            onView={() => { setViewingModo("cliente"); setViewing(c); }}
          />
        ))}
        {/* === PESTAÑA CODEUDORES: lista de codeudores (gestión aparte) === */}
        {!isLoading && tab === "codeudores" && filtered.filter((c) => c.codeudor).slice(0, 100).map((c) => (
          <CodeudorCard
            key={`cod-${c.id}`}
            cliente={c}
            onView={() => { setViewingModo("codeudor"); setViewing(c); }}
            onEditCodeudor={() => setEditingCodeudor(c)}
          />
        ))}
        {filtered.length > 100 && (
          <p className="text-center text-xs text-muted-foreground py-2">
            Mostrando 100 de {filtered.length} — usa el buscador para filtrar
          </p>
        )}
      </div>

      {viewing && (
        <NotifDetalle
          cliente={viewing}
          modo={viewingModo}
          onClose={() => setViewing(null)}
        />
      )}

      {editingCodeudor && (
        <CodeudorDialog
          cliente={editingCodeudor}
          onClose={() => setEditingCodeudor(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// TARJETA DE CLIENTE (TITULAR) — sin codeudor debajo
// (los codeudores se gestionan aparte en la pestaña "Codeudores")
// ============================================================

function NotifCard({ cliente, onView }: {
  cliente: any;
  onView: () => void;
}) {
  const qc = useQueryClient();
  const [showEditMonto, setShowEditMonto] = useState(false);

  // === MODO MANUAL: abrir WhatsApp con mensaje pre-cargado ===
  // Genera el mensaje y abre wa.me con el texto pre-cargado
  const abrirWhatsappCliente = async () => {
    try {
      // Generar mensaje
      const genRes = await fetch("/api/notificaciones/generar-mensaje", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modo: "cliente", cliente }),
      });
      if (!genRes.ok) throw new Error("Error al generar mensaje");
      const { mensaje } = await genRes.json();

      // Normalizar teléfono: 0986101358 → 595986101358
      const tel = String(cliente.telefono || "").replace(/\D/g, "");
      let phone = tel;
      if (tel.startsWith("09")) phone = "595" + tel.slice(1);
      else if (tel.startsWith("9") && tel.length === 9) phone = "595" + tel;

      // Marcar cuotas como notificadas en la DB
      const cuotaIds = cliente.cuotas?.map((q: any) => q.id) || [];
      await fetch("/api/whatsapp/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telefono: cliente.telefono, mensaje, clienteId: cliente.id, cuotaIds,
          modoManual: true,  // no envía por API, solo marca en DB
        }),
      });

      // Abrir WhatsApp con mensaje pre-cargado
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(mensaje)}`;
      window.open(url, "_blank");
      toast.success(`Abriendo WhatsApp para ${cliente.entidad}`);
      qc.invalidateQueries({ queryKey: ["notifs"] });
    } catch (e: any) {
      toast.error(e.message || "Error");
    }
  };

  const sinTelefono = !cliente.telefono;
  const todasNotificadas = cliente.todasNotificadas;
  const diasColor =
    cliente.maxDiasAtraso > 60 ? "text-red-400" :
    cliente.maxDiasAtraso > 30 ? "text-orange-400" :
    cliente.maxDiasAtraso > 0 ? "text-amber-400" : "text-emerald-400";

  return (
    <Card className={`glass-card p-3 transition-all ${todasNotificadas ? "opacity-50 border-emerald-500/20" : ""}`}>
      {/* === FILA PRINCIPAL: CLIENTE === */}
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 shrink-0 border-primary/30 text-primary">
              #{cliente.codigoEntidad}
            </Badge>
            <p className="font-semibold truncate">{cliente.entidad}</p>
            {cliente.judicial === "S" && <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
            {todasNotificadas && (
              <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                ✓ Notificado
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <Phone className="w-3 h-3" />
              {sinTelefono ? <span className="text-amber-400">Sin teléfono</span> : fmtPhone(cliente.telefono)}
            </span>
            <span>·</span>
            <span className={`font-semibold ${diasColor}`}>
              {cliente.maxDiasAtraso > 0 ? `${cliente.maxDiasAtraso}d atraso` : "Por vencer"}
            </span>
            {cliente.sucursal && <><span>·</span><span>{cliente.sucursal}</span></>}
            {cliente.ultimaNotificacion && (
              <>
                <span>·</span>
                <span className="text-emerald-400" title={fmtDateTime(cliente.ultimaNotificacion)}>
                  últ. notif. {fmtRelative(cliente.ultimaNotificacion)}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-amber-400">{fmtGs(cliente.totalGs)}</p>
          {cliente.totalInteres > 0 && (
            <p className="text-[9px] text-orange-400/70">
              +{fmtGs(cliente.totalInteres)} interés
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <Button variant="ghost" size="sm" onClick={onView} className="h-7 text-xs">
            <Eye className="w-3.5 h-3.5 mr-1" /> Ver
          </Button>
          <Button
            variant="outline" size="sm"
            className="h-7 text-xs text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
            onClick={() => setShowEditMonto(true)}
            title="Editar monto antes de enviar"
          >
            <Edit2 className="w-3.5 h-3.5 mr-1" />
            Editar
          </Button>
          <Button
            size="sm" className="h-7 text-xs glow-primary"
            disabled={sinTelefono}
            onClick={abrirWhatsappCliente}
          >
            <Send className="w-3.5 h-3.5 mr-1" />
            Cliente
          </Button>
        </div>
      </div>

      {/* === MODAL: Editar montos antes de enviar === */}
      {showEditMonto && (
        <EditMontoDialog
          cliente={cliente}
          onClose={() => setShowEditMonto(false)}
          onSaved={() => {
            setShowEditMonto(false);
            qc.invalidateQueries({ queryKey: ["notifs"] });
            qc.invalidateQueries({ queryKey: ["clientes"] });
            qc.invalidateQueries({ queryKey: ["dashboard"] });
          }}
        />
      )}

      {/* === FILA TERCIARIA: GARANTES MÚLTIPLES === */}
      <GarantesSection cliente={cliente} />
    </Card>
  );
}

// ============================================================
// SECCIÓN DE GARANTES MÚLTIPLES
// ============================================================

function GarantesSection({ cliente }: { cliente: any }) {
  const qc = useQueryClient();
  const [showAgregar, setShowAgregar] = useState(false);
  const [editingGarante, setEditingGarante] = useState<any | null>(null);
  const [nuevoGarante, setNuevoGarante] = useState({
    garanteNombre: "",
    garanteTelefono: "",
    garanteCi: "",
    garanteParentesco: "",
  });
  const [saving, setSaving] = useState(false);

  const garantes = cliente.garantes || [];

  const agregarGarante = async () => {
    if (!nuevoGarante.garanteNombre.trim()) {
      toast.error("El nombre del garante es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(`/api/clientes/${cliente.id}/garantes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          garanteNombre: nuevoGarante.garanteNombre.trim(),
          garanteTelefono: nuevoGarante.garanteTelefono.trim(),
          garanteCi: nuevoGarante.garanteCi.trim(),
          garanteParentesco: nuevoGarante.garanteParentesco.trim(),
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || `Error HTTP ${r.status}`);
      }
      const data = await r.json();
      toast.success(data.msg || "Garante agregado");
      setNuevoGarante({ garanteNombre: "", garanteTelefono: "", garanteCi: "", garanteParentesco: "" });
      setShowAgregar(false);
      qc.invalidateQueries({ queryKey: ["notifs"] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
    } catch (e: any) {
      toast.error(e.message || "Error");
    } finally {
      setSaving(false);
    }
  };

  const actualizarGarante = async (garanteId: string, datos: any) => {
    setSaving(true);
    try {
      const r = await fetch(`/api/clientes/${cliente.id}/garantes/${garanteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || `Error HTTP ${r.status}`);
      }
      const data = await r.json();
      toast.success(data.msg || "Garante actualizado");
      setEditingGarante(null);
      qc.invalidateQueries({ queryKey: ["notifs"] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
    } catch (e: any) {
      toast.error(e.message || "Error");
    } finally {
      setSaving(false);
    }
  };

  const eliminarGarante = async (garanteId: string, nombre: string) => {
    if (!confirm(`¿Eliminar el garante ${nombre}?`)) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/clientes/${cliente.id}/garantes/${garanteId}`, { method: "DELETE" });
      if (!r.ok) throw new Error();
      toast.success("Garante eliminado");
      qc.invalidateQueries({ queryKey: ["notifs"] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
    } catch {
      toast.error("Error al eliminar");
    } finally {
      setSaving(false);
    }
  };

  const abrirWhatsappGarante = async (garante: any) => {
    if (!garante.garanteTelefono) {
      toast.error("Este garante no tiene teléfono");
      return;
    }
    // Generar mensaje para el garante
    try {
      const genRes = await fetch("/api/notificaciones/generar-mensaje", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modo: "codeudor", cliente }),
      });
      if (!genRes.ok) throw new Error("Error al generar mensaje");
      const { mensaje } = await genRes.json();

      const tel = String(garante.garanteTelefono).replace(/\D/g, "");
      let phone = tel;
      if (tel.startsWith("09")) phone = "595" + tel.slice(1);
      else if (tel.startsWith("9") && tel.length === 9) phone = "595" + tel;

      const url = `https://wa.me/${phone}?text=${encodeURIComponent(mensaje)}`;
      window.open(url, "_blank");
      toast.success(`Abriendo WhatsApp para ${garante.garanteNombre}`);
    } catch (e: any) {
      toast.error(e.message || "Error");
    }
  };

  if (garantes.length === 0 && !showAgregar) {
    return (
      <div className="mt-2 pt-2 border-t border-border/30 flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground italic flex items-center gap-1">
          <UserPlus className="w-3 h-3" /> Sin garantes adicionales
        </p>
        <Button
          variant="ghost" size="sm"
          className="h-7 text-xs text-sky-300 hover:bg-sky-500/10"
          onClick={() => setShowAgregar(true)}
        >
          <UserPlus className="w-3.5 h-3.5 mr-1" /> Agregar Garante
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Lista de garantes */}
      {garantes.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border/30 space-y-1.5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-semibold text-sky-300 uppercase tracking-wider flex items-center gap-1">
              <UserPlus className="w-3 h-3" /> Garantes ({garantes.length})
            </p>
            <Button
              variant="ghost" size="sm"
              className="h-6 text-[11px] text-sky-300 hover:bg-sky-500/10 px-2"
              onClick={() => setShowAgregar(true)}
            >
              <UserPlus className="w-3 h-3 mr-1" /> Agregar
            </Button>
          </div>
          {garantes.map((g: any, idx: number) => (
            <div key={g.id} className="flex items-center gap-2 p-1.5 rounded-lg bg-sky-500/5 border border-sky-500/15">
              <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-300 flex items-center justify-center shrink-0 text-[10px] font-bold">
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-xs truncate">{g.garanteNombre}</p>
                  <Badge variant="outline" className="text-sky-300 border-sky-500/30 text-[9px] py-0">
                    Garante
                  </Badge>
                  {g.garanteParentesco && (
                    <span className="text-[10px] text-muted-foreground">{g.garanteParentesco}</span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Phone className="w-2.5 h-2.5" />
                  {g.garanteTelefono ? fmtPhone(g.garanteTelefono) : <span className="text-amber-400">Sin teléfono</span>}
                  {g.garanteCi && <span className="ml-2">· CI: {g.garanteCi}</span>}
                </p>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                {editingGarante?.id === g.id ? (
                  <GaranteEditInline
                    garante={g}
                    saving={saving}
                    onGuardar={(datos) => actualizarGarante(g.id, datos)}
                    onCancelar={() => setEditingGarante(null)}
                  />
                ) : (
                  <>
                    <Button
                      size="sm" variant="ghost"
                      className="h-6 w-6 p-0 text-sky-300 hover:bg-sky-500/10"
                      disabled={!g.garanteTelefono}
                      onClick={() => abrirWhatsappGarante(g)}
                      title="Notificar por WhatsApp"
                    >
                      <Send className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      className="h-6 w-6 p-0 text-sky-300 hover:bg-sky-500/10"
                      onClick={() => setEditingGarante(g)}
                      title="Editar garante"
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      className="h-6 w-6 p-0 text-red-400 hover:bg-red-500/10"
                      disabled={saving}
                      onClick={() => eliminarGarante(g.id, g.garanteNombre)}
                      title="Eliminar garante"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formulario para agregar nuevo garante */}
      {showAgregar && (
        <div className="mt-2 pt-2 border-t border-border/30 p-3 rounded-lg bg-sky-500/5 border border-sky-500/20 space-y-2">
          <p className="text-xs font-semibold text-sky-300 uppercase tracking-wider">Nuevo Garante</p>
          <Input
            placeholder="Nombre completo *"
            value={nuevoGarante.garanteNombre}
            onChange={(e) => setNuevoGarante({ ...nuevoGarante, garanteNombre: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Teléfono (opcional)"
              value={nuevoGarante.garanteTelefono}
              onChange={(e) => setNuevoGarante({ ...nuevoGarante, garanteTelefono: e.target.value })}
            />
            <Input
              placeholder="CI (opcional)"
              value={nuevoGarante.garanteCi}
              onChange={(e) => setNuevoGarante({ ...nuevoGarante, garanteCi: e.target.value })}
            />
          </div>
          <Input
            placeholder="Parentesco (Esposo/a, Padre, etc.)"
            value={nuevoGarante.garanteParentesco}
            onChange={(e) => setNuevoGarante({ ...nuevoGarante, garanteParentesco: e.target.value })}
          />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowAgregar(false)}>
              Cancelar
            </Button>
            <Button
              size="sm" className="h-7 text-xs glow-primary"
              onClick={agregarGarante}
              disabled={saving || !nuevoGarante.garanteNombre.trim()}
            >
              {saving ? "Guardando…" : "💾 Agregar Garante"}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// EDICIÓN INLINE DE GARANTE
// ============================================================
function GaranteEditInline({ garante, saving, onGuardar, onCancelar }: {
  garante: any;
  saving: boolean;
  onGuardar: (datos: any) => void;
  onCancelar: () => void;
}) {
  const [form, setForm] = useState({
    garanteNombre: garante.garanteNombre || "",
    garanteTelefono: garante.garanteTelefono || "",
    garanteCi: garante.garanteCi || "",
    garanteParentesco: garante.garanteParentesco || "",
  });

  return (
    <div className="flex flex-col gap-1 w-full p-2 rounded-lg bg-sky-500/10 border border-sky-500/30">
      <Input
        className="h-7 text-xs"
        placeholder="Nombre *"
        value={form.garanteNombre}
        onChange={(e) => setForm({ ...form, garanteNombre: e.target.value })}
      />
      <div className="grid grid-cols-2 gap-1">
        <Input
          className="h-7 text-xs"
          placeholder="Teléfono"
          value={form.garanteTelefono}
          onChange={(e) => setForm({ ...form, garanteTelefono: e.target.value })}
        />
        <Input
          className="h-7 text-xs"
          placeholder="CI"
          value={form.garanteCi}
          onChange={(e) => setForm({ ...form, garanteCi: e.target.value })}
        />
      </div>
      <Input
        className="h-7 text-xs"
        placeholder="Parentesco"
        value={form.garanteParentesco}
        onChange={(e) => setForm({ ...form, garanteParentesco: e.target.value })}
      />
      <div className="flex gap-1">
        <Button size="sm" variant="outline" className="h-6 text-xs flex-1" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button
          size="sm" className="h-6 text-xs flex-1 glow-primary"
          disabled={saving || !form.garanteNombre.trim()}
          onClick={() => onGuardar(form)}
        >
          {saving ? "…" : "💾 Guardar"}
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// DIALOG: REGISTRAR / EDITAR CODEUDOR
// ============================================================

function CodeudorDialog({ cliente, onClose }: { cliente: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    codeudorNombre: cliente.codeudor?.nombre || "",
    codeudorTelefono: cliente.codeudor?.telefono || "",
    codeudorCi: cliente.codeudor?.ci || "",
    codeudorParentesco: cliente.codeudor?.parentesco || "",
  });
  const [busqueda, setBusqueda] = useState("");
  const [showBuscar, setShowBuscar] = useState(false);

  // Buscar clientes existentes para sugerir como codeudor
  const { data: sugeridos } = useQuery({
    queryKey: ["buscar-cliente", busqueda],
    queryFn: async () => {
      if (busqueda.length < 2) return { clientes: [] };
      const r = await fetch(`/api/clientes/buscar?q=${encodeURIComponent(busqueda)}`);
      if (!r.ok) throw new Error();
      return r.json();
    },
    enabled: busqueda.length >= 2,
  });

  const guardar = useMutation({
    mutationFn: async (override?: Partial<typeof form>) => {
      const formFinal = override ? { ...form, ...override } : form;
      // Validación: solo el nombre es obligatorio, el teléfono puede ser vacío
      const nombreTrim = (formFinal.codeudorNombre || "").trim();
      if (!nombreTrim) {
        throw new Error("El nombre del codeudor es obligatorio");
      }

      // Limpiar valores: si el teléfono está vacío, enviarlo como string vacío
      // El backend guarda null si viene vacío
      const payload = {
        codeudorNombre: nombreTrim,
        codeudorTelefono: (formFinal.codeudorTelefono || "").trim(),
        codeudorCi: (formFinal.codeudorCi || "").trim(),
        codeudorParentesco: (formFinal.codeudorParentesco || "").trim(),
      };

      console.log("[codeudor] Guardando con payload:", payload);
      console.log("[codeudor] Cliente ID:", cliente.id);

      const r = await fetch(`/api/clientes/${cliente.id}/codeudor`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.log("[codeudor] Response status:", r.status);

      if (!r.ok) {
        const errText = await r.text();
        console.error("[codeudor] Error response:", errText);
        let errMsg = `Error HTTP ${r.status}`;
        try {
          const errData = JSON.parse(errText);
          errMsg = errData.error || errMsg;
        } catch {}
        throw new Error(errMsg);
      }

      const data = await r.json();
      console.log("[codeudor] Success response:", data);
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["notifs"] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      toast.success(data?.msg || "Codeudor guardado correctamente");
      onClose();
    },
    onError: (e: any) => {
      console.error("[codeudor] Error al guardar:", e);
      toast.error(e.message || "Error al guardar el codeudor");
    },
  });

  // Función explícita para guardar sin teléfono (borra el teléfono antes de guardar)
  const guardarSinTelefono = () => {
    console.log("[codeudor] guardarSinTelefono — borrando teléfono");
    setForm({ ...form, codeudorTelefono: "" });
    // Pasar el override directamente a mutate para que use el teléfono vacío
    guardar.mutate({ codeudorTelefono: "" });
  };

  const eliminar = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/clientes/${cliente.id}/codeudor`, { method: "DELETE" });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifs"] });
      toast.success("Codeudor eliminado");
      onClose();
    },
  });

  function seleccionarSugerido(s: any) {
    setForm({
      ...form,
      codeudorNombre: s.entidad,
      codeudorTelefono: s.telefono || "",
      codeudorCi: s.ciEntidad || "",
    });
    setShowBuscar(false);
    setBusqueda("");
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-violet-400" />
            {cliente.codeudor ? "Editar Codeudor" : "Registrar Codeudor"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Deudor: <strong>{cliente.entidad}</strong> ({cliente.codigoEntidad})
          </p>
        </DialogHeader>

        <div className="space-y-3">
          {/* Buscar cliente existente */}
          <div>
            <Button
              type="button" variant="outline" size="sm"
              className="w-full"
              onClick={() => setShowBuscar(!showBuscar)}
            >
              <Search className="w-3.5 h-3.5 mr-1" /> {showBuscar ? "Ocultar búsqueda" : "Buscar cliente existente"}
            </Button>
            {showBuscar && (
              <div className="mt-2 space-y-2">
                <Input
                  placeholder="Buscar por nombre, código, CI o teléfono…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
                {sugeridos?.clientes?.length > 0 && (
                  <div className="max-h-40 overflow-y-auto space-y-1 border border-border/40 rounded-lg p-1">
                    {sugeridos.clientes.map((s: any) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => seleccionarSugerido(s)}
                        className="w-full text-left p-2 rounded hover:bg-secondary/60 text-xs"
                      >
                        <p className="font-medium">{s.entidad}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {s.codigoEntidad} · {fmtPhone(s.telefono)} · {s.localidad || "—"}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
                {busqueda.length >= 2 && !sugeridos?.clientes?.length && (
                  <p className="text-xs text-muted-foreground text-center py-2">Sin resultados</p>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-border/30 pt-3 space-y-3">
            <div>
              <Label className="text-xs">Nombre del codeudor *</Label>
              <Input
                value={form.codeudorNombre}
                onChange={(e) => setForm({ ...form, codeudorNombre: e.target.value })}
                placeholder="Ej: JUAN PEREZ (codeudor)"
              />
            </div>
            <div>
              <Label className="text-xs">Teléfono (opcional)</Label>
              <Input
                value={form.codeudorTelefono}
                onChange={(e) => setForm({ ...form, codeudorTelefono: e.target.value })}
                placeholder="0981123456 — podés dejar vacío"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Si lo borrás, el codeudor se mantiene sin teléfono. Podés editarlo después.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">CI</Label>
                <Input
                  value={form.codeudorCi}
                  onChange={(e) => setForm({ ...form, codeudorCi: e.target.value })}
                  placeholder="1234567"
                />
              </div>
              <div>
                <Label className="text-xs">Parentesco</Label>
                <Input
                  value={form.codeudorParentesco}
                  onChange={(e) => setForm({ ...form, codeudorParentesco: e.target.value })}
                  placeholder="Esposo/a, Padre…"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {cliente.codeudor && (
            <Button
              variant="ghost" size="sm"
              className="text-destructive mr-auto"
              onClick={() => eliminar.mutate()}
              disabled={eliminar.isPending}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Eliminar
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          {form.codeudorTelefono && (
            <Button
              variant="outline"
              className="text-amber-400 border-amber-500/40 hover:bg-amber-500/10"
              onClick={guardarSinTelefono}
              disabled={guardar.isPending}
              title="Borra el teléfono y guarda el codeudor sin teléfono"
            >
              {guardar.isPending ? "Guardando…" : "🗑️ Borrar Teléfono y Guardar"}
            </Button>
          )}
          <Button
            onClick={() => guardar.mutate(undefined)}
            disabled={guardar.isPending || !form.codeudorNombre}
          >
            {guardar.isPending ? "Guardando…" : "💾 Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// DIALOG: VER DETALLE + PREVIEW DE MENSAJE
// ============================================================

function NotifDetalle({ cliente, modo, onClose }: { cliente: any; modo: string; onClose: () => void }) {
  const { data: msgData, isLoading } = useQuery({
    queryKey: ["preview-msg", cliente.id, modo],
    queryFn: async () => {
      const r = await fetch("/api/notificaciones/generar-mensaje", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modo, cliente }),
      });
      if (!r.ok) throw new Error();
      return r.json();
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs font-mono px-2 py-0.5 border-primary/40 text-primary shrink-0">
              #{cliente.codigoEntidad}
            </Badge>
            <span className="truncate">
              {modo === "codeudor" ? `Codeudor de ${cliente.entidad}` : cliente.entidad}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[65vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Row label="Código Entidad" value={cliente.codigoEntidad} />
            <Row label="Teléfono" value={fmtPhone(modo === "codeudor" ? cliente.codeudor?.telefono : cliente.telefono)} />
            <Row label="Sucursal" value={cliente.sucursal || "—"} />
            <Row label="Total Deuda" value={fmtGs(cliente.totalGs)} highlight />
            {cliente.totalInteres > 0 && (
              <>
                <Row label="Saldo s/ interés" value={fmtGs(cliente.totalSaldoSinInteres)} />
                <Row label="Interés acum." value={`+${fmtGs(cliente.totalInteres)}`} />
              </>
            )}
            <Row label="Máx. Atraso" value={`${cliente.maxDiasAtraso || 0} días`} />
            <Row label="Vendedor" value={cliente.vendedor || "—"} />
          </div>

          {modo === "codeudor" && cliente.codeudor && (
            <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20 text-xs">
              <p className="font-semibold text-violet-300">{cliente.codeudor.nombre}</p>
              <p className="text-muted-foreground">
                {fmtPhone(cliente.codeudor.telefono)}
                {cliente.codeudor.parentesco ? ` · ${cliente.codeudor.parentesco}` : ""}
              </p>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Detalle de Deudas</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {cliente.cuotas?.map((q: any) => (
                <div key={q.id} className="flex justify-between p-2 rounded-lg bg-secondary/40 text-xs">
                  <div>
                    <p>{fmtGs(q.saldoTotalGs || q.saldoGs)}</p>
                    {q.interesGs > 0 && (
                      <p className="text-[10px] text-orange-400/70">+{fmtGs(q.interesGs)} interés</p>
                    )}
                    <p className="text-[10px] text-muted-foreground">Vence: {new Date(q.fechaVcto).toLocaleDateString("es-PY")}</p>
                  </div>
                  <Badge variant={q.diasAtrasado > 0 ? "destructive" : "secondary"} className="text-[10px]">
                    {diasEstado(q.diasAtrasado)}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {modo === "codeudor" ? "Mensaje al codeudor" : "Mensaje al cliente"}
            </p>
            {isLoading ? (
              <div className="p-3 rounded-lg bg-secondary/40 text-sm text-muted-foreground">Generando mensaje…</div>
            ) : (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm whitespace-pre-wrap">
                {msgData?.mensaje || "Error al generar"}
              </div>
            )}
          </div>
        </div>
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

// ============================================================
// EDITAR MONTO Y INTERÉS ANTES DE ENVIAR NOTIFICACIÓN
// ============================================================
// Permite editar el saldoGs Y el interesGs de cada cuota del cliente.
// Al guardar:
//   1. Llama a PATCH /api/cuotas (que recalcula días, marca montoEditado=true y interesManual=true si se editó interés)
//   2. Actualiza la UI automáticamente
//   3. NO pierde: notificado, ultimaNotificacion, codeudor, estado cobrada
//   4. El sistema sigue calculando día a día los días de atraso
//   5. El interés manual se respeta en el recálculo diario (no se sobreescribe)
function EditMontoDialog({ cliente, onClose, onSaved }: {
  cliente: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Estado local con los montos editables de cada cuota
  const [montos, setMontos] = useState<Record<string, string>>(
    () => Object.fromEntries(
      (cliente.cuotas || []).map((q: any) => [q.id, String(q.saldoGs || 0)])
    )
  );
  // Estado local con los intereses editables de cada cuota
  const [intereses, setIntereses] = useState<Record<string, string>>(
    () => Object.fromEntries(
      (cliente.cuotas || []).map((q: any) => [q.id, String(q.interesGs || 0)])
    )
  );
  const [saving, setSaving] = useState(false);

  // Calcular totales en tiempo real basado en los valores editados
  const calcularTotal = () => {
    let total = 0;
    let interesTotal = 0;
    let saldoTotal = 0;
    for (const q of cliente.cuotas || []) {
      const saldo = Number(montos[q.id] || 0);
      const interes = Number(intereses[q.id] || 0);
      saldoTotal += saldo;
      interesTotal += interes;
      total += saldo + interes;
    }
    return { total, interesTotal, saldoTotal };
  };

  const { total, interesTotal, saldoTotal } = calcularTotal();

  const guardar = async () => {
    setSaving(true);
    let exitosos = 0;
    let errores = 0;
    // Guardar cada cuota que cambió (saldo o interés)
    for (const q of cliente.cuotas || []) {
      const nuevoMonto = Number(montos[q.id] || 0);
      const nuevoInteres = Number(intereses[q.id] || 0);
      const montoOriginal = q.saldoGs || 0;
      const interesOriginal = q.interesGs || 0;

      // Si no cambió nada, saltar
      if (nuevoMonto === montoOriginal && nuevoInteres === interesOriginal) continue;

      try {
        // Enviar saldoGs y interesGs al endpoint
        // El endpoint marca montoEditado=true y interesManual=true
        const body: any = { id: q.id, saldoGs: nuevoMonto };
        // Solo enviar interesGs si cambió
        if (nuevoInteres !== interesOriginal) {
          body.interesGs = nuevoInteres;
        }
        const r = await fetch("/api/cuotas", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (r.ok) exitosos++;
        else errores++;
      } catch {
        errores++;
      }
    }
    setSaving(false);
    if (exitosos > 0 && errores === 0) {
      toast.success(`${exitosos} cuota(s) actualizada(s) — replicado en deudas`);
    } else if (exitosos > 0 && errores > 0) {
      toast.warning(`${exitosos} actualizadas, ${errores} con error`);
    } else if (errores > 0) {
      toast.error(`Error al actualizar ${errores} cuota(s)`);
    } else {
      toast.info("No hubo cambios para guardar");
    }
    if (exitosos > 0) onSaved();
    else onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-amber-400" />
            Editar Saldos e Intereses — {cliente.entidad}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-1 mb-2">
          <p className="text-[10px] text-muted-foreground">
            Código: {cliente.codigoEntidad} · {cliente.cuotas?.length || 0} cuota(s) pendiente(s) · Editá los valores y el sistema calcula el total
          </p>
        </div>

        {/* Encabezado de columnas */}
        <div className="grid grid-cols-12 gap-2 px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          <div className="col-span-4">Vencimiento</div>
          <div className="col-span-3 text-right">Saldo Gs</div>
          <div className="col-span-3 text-right">Interés Gs</div>
          <div className="col-span-2 text-right">Total</div>
        </div>

        {/* Lista de cuotas editables */}
        <div className="space-y-2 max-h-[45vh] overflow-y-auto">
          {(cliente.cuotas || []).map((q: any) => {
            const saldo = Number(montos[q.id] || 0);
            const interes = Number(intereses[q.id] || 0);
            const totalCuota = saldo + interes;
            const cambioSaldo = saldo !== (q.saldoGs || 0);
            const cambioInteres = interes !== (q.interesGs || 0);
            const cambio = cambioSaldo || cambioInteres;

            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            const vcto = new Date(q.fechaVcto);
            vcto.setHours(0, 0, 0, 0);
            const dias = Math.max(0, Math.floor((hoy.getTime() - vcto.getTime()) / (1000 * 60 * 60 * 24)));

            return (
              <div key={q.id} className={`p-2.5 rounded-lg border ${cambio ? "border-amber-500/40 bg-amber-500/5" : "border-border/40 bg-secondary/20"}`}>
                <div className="grid grid-cols-12 gap-2 items-center">
                  {/* Vencimiento */}
                  <div className="col-span-4">
                    <p className="text-xs font-medium">{fmtDate(q.fechaVcto)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {dias > 0 ? `${dias}d atraso` : "Por vencer"}
                    </p>
                    {q.montoEditado && (
                      <Badge variant="outline" className="text-[9px] py-0 px-1 text-amber-400 border-amber-500/30 mt-0.5">
                        editado
                      </Badge>
                    )}
                    {q.interesManual && (
                      <Badge variant="outline" className="text-[9px] py-0 px-1 text-orange-400 border-orange-500/30 ml-1">
                        interés manual
                      </Badge>
                    )}
                  </div>
                  {/* Saldo editable */}
                  <div className="col-span-3">
                    <Input
                      type="number"
                      className="h-8 text-xs text-right"
                      value={montos[q.id]}
                      onChange={(e) => setMontos({ ...montos, [q.id]: e.target.value })}
                    />
                  </div>
                  {/* Interés editable */}
                  <div className="col-span-3">
                    <Input
                      type="number"
                      className="h-8 text-xs text-right text-orange-300"
                      value={intereses[q.id]}
                      onChange={(e) => setIntereses({ ...intereses, [q.id]: e.target.value })}
                    />
                  </div>
                  {/* Total calculado */}
                  <div className="col-span-2 text-right">
                    <p className="text-sm font-bold text-amber-400">₲ {totalCuota.toLocaleString("es-PY")}</p>
                  </div>
                </div>
                {cambio && (
                  <div className="grid grid-cols-12 gap-2 mt-1 text-[10px]">
                    <div className="col-span-12 text-amber-400">
                      {cambioSaldo && <span>↔ Saldo: ₲ {(q.saldoGs || 0).toLocaleString("es-PY")} → ₲ {saldo.toLocaleString("es-PY")} · </span>}
                      {cambioInteres && <span>↔ Interés: ₲ {(q.interesGs || 0).toLocaleString("es-PY")} → ₲ {interes.toLocaleString("es-PY")}</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {(!cliente.cuotas || cliente.cuotas.length === 0) && (
            <p className="text-center text-xs text-muted-foreground py-6">
              Este cliente no tiene cuotas pendientes
            </p>
          )}
        </div>

        {/* Resumen total — solo aparece cuando hay cambios o siempre visible */}
        <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 space-y-1">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <p className="text-muted-foreground">Saldo total:</p>
              <p className="font-medium">₲ {saldoTotal.toLocaleString("es-PY")}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Interés total:</p>
              <p className="font-medium text-orange-400">₲ {interesTotal.toLocaleString("es-PY")}</p>
            </div>
            <div className="text-right">
              <p className="text-amber-400 font-semibold">Total a notificar:</p>
              <p className="font-bold text-amber-400 text-lg">₲ {total.toLocaleString("es-PY")}</p>
            </div>
          </div>
        </div>

        <div className="text-[10px] text-amber-400 italic p-2 rounded bg-amber-500/5 border border-amber-500/20">
          ⚠ Al guardar, cada cuota se marca como <strong>editada</strong> (no se pisará al re-importar).
          El interés se respeta como valor manual — el sistema sigue calculando día a día los días de atraso, pero NO sobreescribe el interés que pongas.
          Los cambios se replican automáticamente en el módulo <strong>Deudas</strong>.
          No se pierde: notificado, última notificación, codeudor, estado cobrada.
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={guardar}
            disabled={saving}
            className="glow-primary"
          >
            {saving ? "Guardando…" : "Guardar y Replicar a Deudas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// TARJETA DE CODEUDOR (pestaña "Codeudores")
// ============================================================
// Gestiona los codeudores APARTE de los titulares.
// Cada tarjeta muestra:
//   - Nombre del codeudor + teléfono + parentesco
//   - Titular asociado (nombre y código)
//   - Total a cobrar (heredado del titular)
//   - Botones: Ver detalle / Notificar por WhatsApp / Editar
// ============================================================

function CodeudorCard({ cliente, onView, onEditCodeudor }: {
  cliente: any;
  onView: () => void;
  onEditCodeudor: () => void;
}) {
  const qc = useQueryClient();
  const codeudor = cliente.codeudor;

  // === MODO MANUAL: abrir WhatsApp con mensaje pre-cargado para el codeudor ===
  const abrirWhatsappCodeudor = async () => {
    try {
      if (!codeudor?.telefono) {
        toast.error("El codeudor no tiene teléfono");
        return;
      }
      // Generar mensaje para el codeudor
      const genRes = await fetch("/api/notificaciones/generar-mensaje", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modo: "codeudor", cliente }),
      });
      if (!genRes.ok) throw new Error("Error al generar mensaje");
      const { mensaje } = await genRes.json();

      // Normalizar teléfono
      const tel = String(codeudor.telefono).replace(/\D/g, "");
      let phone = tel;
      if (tel.startsWith("09")) phone = "595" + tel.slice(1);
      else if (tel.startsWith("9") && tel.length === 9) phone = "595" + tel;

      // Marcar cuotas del TITULAR como notificadas en la DB (no del codeudor)
      const cuotaIds = cliente.cuotas?.map((q: any) => q.id) || [];
      await fetch("/api/whatsapp/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telefono: codeudor.telefono,
          mensaje,
          clienteId: cliente.id,
          cuotaIds,
          modoManual: true,
          esCodeudorGarante: true,  // NO marca cuotas del titular como notificadas
        }),
      });

      // Abrir WhatsApp con mensaje pre-cargado
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(mensaje)}`;
      window.open(url, "_blank");
      toast.success(`Abriendo WhatsApp para ${codeudor.nombre}`);
      qc.invalidateQueries({ queryKey: ["notifs"] });
    } catch (e: any) {
      toast.error(e.message || "Error");
    }
  };

  const sinTelefono = !codeudor?.telefono;

  return (
    <Card className="glass-card p-3 transition-all border-violet-500/20">
      <div className="flex items-center gap-3">
        {/* Avatar del codeudor */}
        <div className="w-10 h-10 rounded-full bg-violet-500/20 text-violet-300 flex items-center justify-center shrink-0">
          <User className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Nombre del codeudor + badge */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-semibold truncate">{codeudor?.nombre || "Sin nombre"}</p>
            <Badge variant="outline" className="text-violet-300 border-violet-500/30 text-[10px]">
              Codeudor
            </Badge>
            {codeudor?.parentesco && (
              <span className="text-[10px] text-muted-foreground">{codeudor.parentesco}</span>
            )}
          </div>

          {/* Teléfono del codeudor */}
          <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
            <Phone className="w-3 h-3" />
            {sinTelefono
              ? <span className="text-amber-400">Sin teléfono</span>
              : fmtPhone(codeudor.telefono)}
          </p>

          {/* Titular asociado */}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
            <span>Titular:</span>
            <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 border-primary/30 text-primary">
              #{cliente.codigoEntidad}
            </Badge>
            <span className="font-medium text-foreground/80 truncate">{cliente.entidad}</span>
          </div>
        </div>

        {/* Total a cobrar (heredado del titular) */}
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-amber-400">{fmtGs(cliente.totalGs)}</p>
          {cliente.totalInteres > 0 && (
            <p className="text-[9px] text-orange-400/70">
              +{fmtGs(cliente.totalInteres)} interés
            </p>
          )}
        </div>

        {/* Botones de acción */}
        <div className="flex flex-col gap-1 shrink-0">
          <Button variant="ghost" size="sm" onClick={onView} className="h-7 text-xs">
            <Eye className="w-3.5 h-3.5 mr-1" /> Ver
          </Button>
          <Button
            size="sm" variant="outline"
            className="h-7 text-xs text-violet-300 border-violet-500/30 hover:bg-violet-500/10"
            disabled={sinTelefono}
            onClick={abrirWhatsappCodeudor}
          >
            <Send className="w-3.5 h-3.5 mr-1" />
            Notificar
          </Button>
          <Button
            size="sm" variant="ghost"
            className="h-7 text-xs text-violet-300 hover:bg-violet-500/10"
            onClick={onEditCodeudor}
            title="Editar codeudor"
          >
            <Edit2 className="w-3.5 h-3.5 mr-1" />
            Editar
          </Button>
        </div>
      </div>
    </Card>
  );
}
