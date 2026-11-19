"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Megaphone, Plus, Upload, Trash2, Send, MessageCircle, Users,
  CheckCircle2, Search, FileSpreadsheet, StopCircle,
  RefreshCw, Smartphone, Info, Copy,
} from "lucide-react";
import { fmtDate, fmtPhone } from "@/lib/format";
import {
  MODOS_ENVIO, ESTADOS_PROMO, ESTADOS_CONTACTO, VARIABLES_PROMO,
  MENSAJE_EJEMPLO, aplicarVariables, linkWhatsapp, modoLabel,
  copiarAlPortapapeles, deduplicarPorTelefono,
} from "@/lib/promociones";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const SELECT_CLASS =
  "w-full rounded-lg border border-border/40 bg-secondary/40 px-3 py-2 text-sm outline-none";

async function apiJson(url: string, options?: RequestInit) {
  const r = await fetch(url, options);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const detalle =
      data?.error ||
      (r.status === 413
        ? "El archivo es demasiado grande para el servidor"
        : `Error ${r.status} del servidor`);
    throw new Error(detalle);
  }
  return data;
}

/** Reintenta una llamada si falla por red o por un 5xx transitorio. */
async function conReintento<T>(fn: () => Promise<T>, intentos = 3): Promise<T> {
  let ultimo: any;
  for (let i = 0; i < intentos; i++) {
    try {
      return await fn();
    } catch (e) {
      ultimo = e;
      if (i < intentos - 1) await new Promise((r) => setTimeout(r, 700 * (i + 1)));
    }
  }
  throw ultimo;
}

const LOTE_CONTACTOS = 2000;

/** Pendientes de una campaña (calculado de los contadores, no de los contactos). */
function pendientesDe(p: any): number {
  if (typeof p.pendientes === "number") return p.pendientes;
  return Math.max(0, (p.totalContactos || 0) - (p.enviados || 0) - (p.errores || 0));
}

type Tab = "pendientes" | "enviados" | "problemas" | "todos";

/* ------------------------------------------------------------------ */
/* Módulo                                                              */
/* ------------------------------------------------------------------ */

export function PromocionesModule({ sucursal }: { sucursal: string }) {
  const qc = useQueryClient();
  const [crearOpen, setCrearOpen] = useState(false);
  const [editar, setEditar] = useState<any | null>(null);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [autoEnviar, setAutoEnviar] = useState(false);

  const listaQuery = useQuery({
    queryKey: ["promociones", sucursal],
    queryFn: () => apiJson(`/api/promociones?sucursal=${encodeURIComponent(sucursal)}`),
  });

  const promociones: any[] = listaQuery.data?.promociones || [];

  const totales = useMemo(() => {
    return promociones.reduce(
      (acc, p) => {
        acc.campanas += 1;
        acc.contactos += p.totalContactos || 0;
        acc.enviados += p.enviados || 0;
        acc.pendientes += typeof p.pendientes === "number"
          ? p.pendientes
          : Math.max(0, (p.totalContactos || 0) - (p.enviados || 0) - (p.errores || 0));
        return acc;
      },
      { campanas: 0, contactos: 0, enviados: 0, pendientes: 0 }
    );
  }, [promociones]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["promociones"] });

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <Megaphone className="w-4 h-4 text-primary" /> Campañas de WhatsApp
          </p>
          <p className="text-[11px] text-muted-foreground">
            Subí el Excel, elegí el mensaje y mandá promociones. No toca clientes ni deudas.
          </p>
        </div>
        <Button onClick={() => setCrearOpen(true)} className="glow-primary shrink-0">
          <Plus className="w-4 h-4 mr-1.5" /> Nueva campaña
        </Button>
      </div>

      {/* Totales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Kpi icon={<Megaphone className="w-4 h-4" />} label="Campañas" value={String(totales.campanas)} accent="violet" />
        <Kpi icon={<Users className="w-4 h-4" />} label="Contactos" value={String(totales.contactos)} accent="sky" />
        <Kpi icon={<CheckCircle2 className="w-4 h-4" />} label="Enviados" value={String(totales.enviados)} accent="emerald" />
        <Kpi icon={<Send className="w-4 h-4" />} label="Pendientes" value={String(totales.pendientes)} accent="amber" />
      </div>

      {/* Lista */}
      {listaQuery.isError && (
        <Card className="border-red-500/40 bg-red-500/10">
          <CardContent className="p-3 flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-red-300">No se pudieron cargar las campañas.</p>
              <p className="text-[11px] text-red-200/80">
                Abrí <span className="font-mono">/api/admin/setup-promociones</span> para preparar la base,
                o corré <span className="font-mono">npx prisma db push</span>.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => listaQuery.refetch()}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      )}

      {listaQuery.isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      )}

      {!listaQuery.isLoading && !listaQuery.isError && promociones.length === 0 && (
        <Card className="glass-card p-10 text-center">
          <Megaphone className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-sm font-medium mb-1">Todavía no hay campañas</p>
          <p className="text-xs text-muted-foreground mb-4">
            Creá una, subí el Excel con nombre y teléfono, y empezá a mandar promos.
          </p>
          <Button onClick={() => setCrearOpen(true)} variant="outline">
            <Plus className="w-4 h-4 mr-1.5" /> Crear la primera
          </Button>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-3">
        {promociones.map((p) => {
          const pct = p.totalContactos > 0 ? (p.enviados / p.totalContactos) * 100 : 0;
          return (
            <Card key={p.id} className="glass-card">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{p.nombre}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {p.descripcion || "Sin descripción"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant="outline" className={`text-[10px] ${ESTADOS_PROMO[p.estado]?.badge || ""}`}>
                      {ESTADOS_PROMO[p.estado]?.label || p.estado}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      {p.modoEnvio === "api" ? <Send className="w-3 h-3" />
                        : p.modoEnvio === "copiar" ? <Copy className="w-3 h-3" />
                        : <Smartphone className="w-3 h-3" />}
                      {modoLabel(p.modoEnvio)}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-muted-foreground">
                      {p.enviados} de {p.totalContactos} enviados
                      {p.errores > 0 ? ` · ${p.errores} con error` : ""}
                    </span>
                    <span className="font-medium">{Math.round(pct)}%</span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>

                <p className="text-[10px] text-muted-foreground line-clamp-2">
                  {p.mensaje}
                </p>

                <div className="flex items-center gap-1.5 pt-1">
                  <Button size="sm" className="h-7 text-xs" onClick={() => { setAutoEnviar(false); setDetalleId(p.id); }}>
                    Abrir
                  </Button>
                  {p.modoEnvio === "api" && pendientesDe(p) > 0 && (
                    <Button
                      size="sm" className="h-7 text-xs glow-primary"
                      onClick={() => { setAutoEnviar(true); setDetalleId(p.id); }}
                      title="Abrir y empezar a enviar por la API"
                    >
                      <Send className="w-3 h-3 mr-1" /> Enviar {pendientesDe(p)}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditar(p)}>
                    Editar
                  </Button>
                  <span className="text-[10px] text-muted-foreground ml-auto hidden sm:inline">
                    {fmtDate(p.createdAt)}
                  </span>
                  <Button
                    size="icon" variant="ghost"
                    className="h-7 w-7 text-red-400"
                    aria-label="Eliminar campaña"
                    onClick={async () => {
                      if (!confirm(`¿Eliminar la campaña "${p.nombre}" y sus contactos?`)) return;
                      try {
                        await apiJson(`/api/promociones/${p.id}`, { method: "DELETE" });
                        toast.success("Campaña eliminada");
                        refresh();
                      } catch (e: any) {
                        toast.error(e.message);
                      }
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {crearOpen && (
        <CampanaDialog
          sucursal={sucursal}
          onClose={() => setCrearOpen(false)}
          onSaved={(id) => {
            setCrearOpen(false);
            refresh();
            setDetalleId(id);
          }}
        />
      )}

      {editar && (
        <CampanaDialog
          sucursal={sucursal}
          campana={editar}
          onClose={() => setEditar(null)}
          onSaved={() => { setEditar(null); refresh(); }}
        />
      )}

      {detalleId && (
        <DetalleCampana
          id={detalleId}
          autoEnviar={autoEnviar}
          onClose={() => { setDetalleId(null); refresh(); }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* KPI                                                                 */
/* ------------------------------------------------------------------ */

function Kpi({ icon, label, value, accent }: {
  icon: React.ReactNode; label: string; value: string;
  accent: "violet" | "sky" | "emerald" | "amber";
}) {
  const map: Record<string, string> = {
    violet: "text-violet-400 bg-violet-500/10",
    sky: "text-sky-400 bg-sky-500/10",
    emerald: "text-emerald-400 bg-emerald-500/10",
    amber: "text-amber-400 bg-amber-500/10",
  };
  return (
    <Card className="glass-card">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
          <span className={`w-6 h-6 rounded-md flex items-center justify-center ${map[accent]}`}>{icon}</span>
        </div>
        <p className="text-lg font-bold leading-none">{value}</p>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Crear / editar campaña                                              */
/* ------------------------------------------------------------------ */

function CampanaDialog({ sucursal, campana, onClose, onSaved }: {
  sucursal: string;
  campana?: any;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const editando = Boolean(campana);
  const [nombre, setNombre] = useState(campana?.nombre || "");
  const [descripcion, setDescripcion] = useState(campana?.descripcion || "");
  const [mensaje, setMensaje] = useState(campana?.mensaje || MENSAJE_EJEMPLO);
  const [modoEnvio, setModoEnvio] = useState(campana?.modoEnvio || "api");
  const [sucursalId, setSucursalId] = useState(
    campana?.sucursalId || (sucursal !== "__TODAS__" ? sucursal : "")
  );
  const [file, setFile] = useState<File | null>(null);
  const [verAyuda, setVerAyuda] = useState(false);
  const [cargando, setCargando] = useState<{ hecho: number; total: number } | null>(null);

  const { data: sucData } = useQuery({
    queryKey: ["sucursales"],
    queryFn: () => apiJson("/api/sucursales"),
    staleTime: 5 * 60 * 1000,
  });
  const sucursales: any[] = sucData?.sucursales || [];

  const guardar = useMutation({
    mutationFn: async () => {
      if (editando) {
        return apiJson(`/api/promociones/${campana.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre, descripcion, mensaje, modoEnvio }),
        });
      }

      if (!file) throw new Error("Subí el Excel con los contactos");

      // El Excel se lee acá, en el navegador: un archivo de 4 MB con 100.000
      // filas no puede viajar entero a Vercel (límite de 4,5 MB) ni entrar en
      // un solo INSERT. Se manda en tandas de 2.000 contactos.
      const { parsearExcelPromociones } = await import("@/lib/promociones-excel");
      const parseo = parsearExcelPromociones(await file.arrayBuffer());
      if (parseo.filas.length === 0) {
        throw new Error(
          "No encontré contactos. Revisá que el Excel tenga una columna de nombre y otra de teléfono."
        );
      }

      const { filas, duplicados } = deduplicarPorTelefono(parseo.filas);
      if (filas.length === 0) throw new Error("El archivo no tenía contactos válidos");

      setCargando({ hecho: 0, total: filas.length });

      const cabecera = {
        nombre,
        descripcion,
        mensaje,
        modoEnvio,
        sucursalId: sucursalId || null,
      };

      const primero = filas.slice(0, LOTE_CONTACTOS);
      const res = await conReintento(() =>
        apiJson("/api/promociones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...cabecera, contactos: primero }),
        })
      );
      setCargando({ hecho: primero.length, total: filas.length });

      const id = res.promocion.id;

      for (let i = LOTE_CONTACTOS; i < filas.length; i += LOTE_CONTACTOS) {
        const lote = filas.slice(i, i + LOTE_CONTACTOS);
        await conReintento(() =>
          apiJson(`/api/promociones/${id}/importar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contactos: lote }),
          })
        );
        setCargando({ hecho: Math.min(i + LOTE_CONTACTOS, filas.length), total: filas.length });
      }

      return {
        ...res,
        importados: filas.length,
        duplicados,
        sinTelefono: parseo.sinTelefono,
        sinNombre: parseo.sinNombre,
      };
    },
    onSuccess: (res: any) => {
      setCargando(null);
      if (editando) {
        toast.success("Campaña actualizada");
        onSaved(campana.id);
      } else {
        const partes = [`${res.importados} contactos cargados`];
        if (res.duplicados > 0) partes.push(`${res.duplicados} repetidos salteados`);
        if (res.sinTelefono > 0) partes.push(`${res.sinTelefono} sin teléfono`);
        toast.success(partes.join(" · "));
        onSaved(res.promocion.id);
      }
    },
    onError: (e: any) => {
      setCargando(null);
      toast.error(e.message);
    },
  });

  const insertarVariable = (v: string) => setMensaje((m) => `${m}${m.endsWith(" ") || !m ? "" : " "}${v}`);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar campaña" : "Nueva campaña de WhatsApp"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nombre de la campaña *</Label>
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Promo diciembre 2026"
              />
            </div>
            <div>
              <Label className="text-xs">Para qué es</Label>
              <Input
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej: motos 150cc con entrega baja"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs">Mensaje *</Label>
              <button
                type="button"
                onClick={() => setVerAyuda((v) => !v)}
                className="text-[10px] text-primary hover:underline inline-flex items-center gap-1"
              >
                <Info className="w-3 h-3" /> Cómo tiene que ser el Excel
              </button>
            </div>
            <Textarea
              rows={5}
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="Escribí el mensaje que van a recibir…"
            />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {VARIABLES_PROMO.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertarVariable(v.key)}
                  className="text-[10px] px-2 py-0.5 rounded-md border border-border/40 bg-secondary/40 hover:bg-secondary/70"
                  title={v.desc}
                >
                  {v.key}
                </button>
              ))}
              <span className="text-[10px] text-muted-foreground ml-1 self-center">
                se reemplazan con los datos de cada contacto
              </span>
            </div>

            {verAyuda && (
              <div className="mt-2 rounded-lg border border-border/40 bg-secondary/20 p-2.5 text-[11px] space-y-1">
                <p className="font-medium">El Excel necesita una fila de encabezados. Ejemplo:</p>
                <div className="overflow-x-auto">
                  <table className="text-[10px] border border-border/30">
                    <thead className="bg-secondary/50">
                      <tr>
                        <th className="px-2 py-1 border border-border/30 text-left">Nombre</th>
                        <th className="px-2 py-1 border border-border/30 text-left">Telefono</th>
                        <th className="px-2 py-1 border border-border/30 text-left">Modelo</th>
                        <th className="px-2 py-1 border border-border/30 text-left">Localidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-2 py-1 border border-border/30">Juan Benítez</td>
                        <td className="px-2 py-1 border border-border/30">0981 123 456</td>
                        <td className="px-2 py-1 border border-border/30">Kenton GT 150</td>
                        <td className="px-2 py-1 border border-border/30">Ciudad del Este</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-muted-foreground">
                  Sirve .xlsx, .xls o .csv. Solo nombre y teléfono son obligatorios; el orden de
                  las columnas no importa.
                </p>
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Forma de envío</Label>
              <select value={modoEnvio} onChange={(e) => setModoEnvio(e.target.value)} className={SELECT_CLASS}>
                {MODOS_ENVIO.map((m) => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground mt-1">
                {MODOS_ENVIO.find((m) => m.key === modoEnvio)?.desc}
              </p>
            </div>
            <div>
              <Label className="text-xs">Sucursal</Label>
              <select
                value={sucursalId}
                onChange={(e) => setSucursalId(e.target.value)}
                className={SELECT_CLASS}
                disabled={editando}
              >
                <option value="">Sin sucursal</option>
                {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
          </div>

          {!editando && (
            <div>
              <Label className="text-xs">Excel de contactos *</Label>
              <label className="mt-1 flex items-center gap-2 rounded-lg border border-dashed border-border/50 bg-secondary/20 px-3 py-3 cursor-pointer hover:bg-secondary/40 transition-colors">
                <FileSpreadsheet className="w-5 h-5 text-primary shrink-0" />
                <span className="text-xs truncate">
                  {file ? file.name : "Elegir archivo (.xlsx, .xls o .csv)"}
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>
          )}

          {editando && (
            <p className="text-[11px] text-muted-foreground">
              Para sumar más contactos, abrí la campaña y usá “Agregar contactos”.
            </p>
          )}
        </div>

        {cargando && (
          <div className="space-y-1.5 rounded-lg border border-border/40 bg-secondary/20 p-2.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">
                Leyendo el Excel y cargando contactos…
              </span>
              <span className="font-medium">
                {cargando.hecho.toLocaleString("es-PY")} / {cargando.total.toLocaleString("es-PY")}
              </span>
            </div>
            <Progress
              value={cargando.total > 0 ? (cargando.hecho / cargando.total) * 100 : 5}
              className="h-1.5"
            />
            <p className="text-[10px] text-muted-foreground">
              No cierres esta ventana. Un archivo de 100.000 filas tarda un par de minutos.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={guardar.isPending}>
            {cargando ? "Esperá…" : "Cancelar"}
          </Button>
          <Button
            onClick={() => guardar.mutate()}
            disabled={guardar.isPending || !nombre.trim() || !mensaje.trim() || (!editando && !file)}
          >
            {guardar.isPending
              ? cargando
                ? `Cargando ${cargando.hecho.toLocaleString("es-PY")} de ${cargando.total.toLocaleString("es-PY")}…`
                : "Preparando…"
              : editando ? "Guardar cambios" : "Crear y cargar contactos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Detalle de la campaña                                               */
/* ------------------------------------------------------------------ */

function DetalleCampana({
  id,
  autoEnviar = false,
  onClose,
}: {
  id: string;
  autoEnviar?: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("pendientes");
  const [busqueda, setBusqueda] = useState("");
  const [busquedaAplicada, setBusquedaAplicada] = useState("");
  const [pagina, setPagina] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [progreso, setProgreso] = useState<{ enviados: number; errores: number; total: number } | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [cargandoAgregar, setCargandoAgregar] = useState<{ hecho: number; total: number } | null>(null);
  const cancelarRef = useRef(false);
  const autoHecho = useRef(false);

  const LIMITE = 100;

  const estadoParam =
    tab === "pendientes" ? "pendiente"
      : tab === "enviados" ? "enviado"
      : tab === "problemas" ? "problemas"
      : undefined;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["promocion", id, tab, busquedaAplicada, pagina],
    queryFn: () => {
      const p = new URLSearchParams();
      if (estadoParam) p.set("estado", estadoParam);
      if (busquedaAplicada) p.set("q", busquedaAplicada);
      p.set("limit", String(LIMITE));
      p.set("offset", String(pagina * LIMITE));
      return apiJson(`/api/promociones/${id}?${p.toString()}`);
    },
    refetchInterval: enviando ? 5000 : false,
  });

  // Buscador con un pequeño retardo para no pedir en cada tecla.
  useEffect(() => {
    const t = setTimeout(() => {
      setBusquedaAplicada(busqueda.trim());
      setPagina(0);
    }, 350);
    return () => clearTimeout(t);
  }, [busqueda]);

  const promocion = data?.promocion;
  const contactos: any[] = data?.contactos || [];
  const totales = data?.totales || { pendiente: 0, enviado: 0, error: 0, omitido: 0, todos: 0 };
  const totalFiltrado: number = data?.totalFiltrado ?? 0;

  const pendientesCount = totales.pendiente;
  const enviadosCount = totales.enviado;
  const problemasCount = totales.error + totales.omitido;

  useEffect(() => {
    if (!promocion) return;
    setProgreso((p) => p || {
      enviados: promocion.enviados || 0,
      errores: promocion.errores || 0,
      total: promocion.totalContactos || 0,
    });
  }, [promocion]);

  const refrescarTodo = async () => {
    await refetch();
    qc.invalidateQueries({ queryKey: ["promociones"] });
  };

  /** Pide a la base el próximo pendiente (sin cargar los 70.000 en el navegador). */
  const siguientePendiente = async (): Promise<any | null> => {
    try {
      const r = await apiJson(`/api/promociones/${id}?estado=pendiente&limit=1`);
      return r.contactos?.[0] || null;
    } catch (e: any) {
      toast.error(e.message);
      return null;
    }
  };

  /* -------------------- Envío automático por API -------------------- */

  const enviarAutomatico = async (confirmar = true) => {
    if (confirmar && !confirm(`¿Enviar los mensajes a ${pendientesCount} contactos por la API de WhatsApp?`)) return;
    if (pendientesCount === 0) return;

    cancelarRef.current = false;
    setEnviando(true);
    setProgreso({
      enviados: promocion.enviados || 0,
      errores: promocion.errores || 0,
      total: promocion.totalContactos || 0,
    });

    let seguir = true;
    try {
      while (seguir && !cancelarRef.current) {
        const r = await apiJson(`/api/promociones/${id}/enviar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limite: 25 }),
        });

        setProgreso((p) => ({
          enviados: (p?.enviados || 0) + (r.enviados || 0),
          errores: (p?.errores || 0) + (r.errores || 0),
          total: r.total || promocion.totalContactos || 0,
        }));

        await refetch();

        if (r.terminado || r.procesados === 0) seguir = false;
        if (r.enviados === 0 && r.errores > 0) seguir = false; // algo sistemático: cortamos
      }

      if (cancelarRef.current) toast.info("Envío detenido. Podés retomarlo cuando quieras.");
      else toast.success("Campaña enviada");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setEnviando(false);
      refrescarTodo();
    }
  };

  // Si llegaron desde el botón "Enviar" de la lista, arranca solo.
  useEffect(() => {
    if (!autoEnviar || autoHecho.current) return;
    if (!data?.promocion) return;
    if (data.promocion.modoEnvio !== "api") return;
    if ((data.totales?.pendiente || 0) === 0) return;
    autoHecho.current = true;
    enviarAutomatico(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEnviar, data]);

  /* -------------------- Envío manual (wa.me) -------------------- */

  const abrirWhatsapp = async (contacto: any) => {
    const mensaje = aplicarVariables(promocion.mensaje, contacto);
    window.open(linkWhatsapp(contacto.telefono, mensaje), "_blank");
    try {
      await apiJson(`/api/promociones/${id}/contactos/${contacto.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "enviado" }),
      });
      await refrescarTodo();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  /* -------------------- Copiar y pegar (ZapFast / WhatsApp Web) -------------------- */

  const copiarMensaje = async (contacto: any, marcar = true) => {
    const mensaje = aplicarVariables(promocion.mensaje, contacto);
    const okCopia = await copiarAlPortapapeles(mensaje);

    if (!okCopia) {
      toast.error("No se pudo copiar. Seleccioná el texto y copialo a mano.");
      return;
    }

    toast.success(`Mensaje de ${contacto.nombre} copiado. Pegalo en WhatsApp o ZapFast.`);

    if (!marcar) return;
    try {
      await apiJson(`/api/promociones/${id}/contactos/${contacto.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "enviado" }),
      });
      await refrescarTodo();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const cambiarEstado = async (contacto: any, estado: string) => {
    try {
      await apiJson(`/api/promociones/${id}/contactos/${contacto.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado }),
      });
      await refrescarTodo();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  /* -------------------- Agregar contactos -------------------- */

  const agregarContactos = async (file: File | null) => {
    if (!file) return;
    setSubiendo(true);
    try {
      const { parsearExcelPromociones } = await import("@/lib/promociones-excel");
      const parseo = parsearExcelPromociones(await file.arrayBuffer());
      if (parseo.filas.length === 0) throw new Error("No encontré contactos en el archivo");

      const { filas } = deduplicarPorTelefono(parseo.filas);
      let agregados = 0;
      let total = promocion.totalContactos || 0;
      setCargandoAgregar({ hecho: 0, total: filas.length });

      for (let i = 0; i < filas.length; i += LOTE_CONTACTOS) {
        const lote = filas.slice(i, i + LOTE_CONTACTOS);
        const r = await conReintento(() =>
          apiJson(`/api/promociones/${id}/importar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contactos: lote }),
          })
        );
        agregados += r.agregados || 0;
        total = r.total || total;
        setCargandoAgregar({ hecho: Math.min(i + LOTE_CONTACTOS, filas.length), total: filas.length });
      }

      toast.success(`${agregados} contactos agregados (total ${total})`);
      await refrescarTodo();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubiendo(false);
      setCargandoAgregar(null);
    }
  };

  if (isLoading || !promocion) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Campaña</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const pct = promocion.totalContactos > 0
    ? (promocion.enviados / promocion.totalContactos) * 100
    : 0;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <Megaphone className="w-4 h-4 text-primary" />
            {promocion.nombre}
            <Badge variant="outline" className={`text-[10px] ${ESTADOS_PROMO[promocion.estado]?.badge || ""}`}>
              {ESTADOS_PROMO[promocion.estado]?.label || promocion.estado}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {modoLabel(promocion.modoEnvio)}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {promocion.descripcion && (
          <p className="text-xs text-muted-foreground">{promocion.descripcion}</p>
        )}

        {/* Progreso */}
        <div className="rounded-lg border border-border/40 bg-secondary/20 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {promocion.enviados} enviados · {pendientesCount} pendientes
              {problemasCount > 0 ? ` · ${problemasCount} con problemas` : ""}
            </span>
            <span className="font-medium">{Math.round(pct)}%</span>
          </div>
          <Progress value={enviando && progreso ? (progreso.enviados / Math.max(1, progreso.total)) * 100 : pct} className="h-2" />

          <div className="flex flex-wrap gap-1.5 pt-1">
            {promocion.modoEnvio === "api" ? (
              pendientesCount > 0 ? (
                enviando ? (
                  <Button
                    size="sm" variant="outline" className="h-8 text-xs"
                    onClick={() => { cancelarRef.current = true; }}
                  >
                    <StopCircle className="w-3.5 h-3.5 mr-1.5" /> Detener
                  </Button>
                ) : (
                  <Button size="sm" className="h-8 text-xs glow-primary" onClick={() => enviarAutomatico()}>
                    <Send className="w-3.5 h-3.5 mr-1.5" /> Enviar a {pendientesCount} pendientes
                  </Button>
                )
              ) : (
                <Badge variant="outline" className="text-[10px] text-emerald-300 border-emerald-500/30">
                  ✓ Sin pendientes
                </Badge>
              )
            ) : promocion.modoEnvio === "copiar" ? (
              pendientesCount > 0 && (
                <Button
                  size="sm" className="h-8 text-xs glow-primary"
                  onClick={async () => {
                    const c = await siguientePendiente();
                    if (c) copiarMensaje(c);
                  }}
                >
                  <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar el siguiente ({pendientesCount})
                </Button>
              )
            ) : (
              pendientesCount > 0 && (
                <Button
                  size="sm" className="h-8 text-xs glow-primary"
                  onClick={async () => {
                    const c = await siguientePendiente();
                    if (c) abrirWhatsapp(c);
                  }}
                >
                  <MessageCircle className="w-3.5 h-3.5 mr-1.5" /> Abrir el siguiente ({pendientesCount})
                </Button>
              )
            )}

            <label className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 px-2.5 h-8 text-xs cursor-pointer hover:bg-secondary">
              <Upload className="w-3.5 h-3.5" />
              {subiendo ? "Subiendo…" : "Agregar contactos"}
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  agregarContactos(e.target.files?.[0] || null);
                  e.currentTarget.value = "";
                }}
              />
            </label>

            <Button
              size="sm" variant="ghost" className="h-8 text-xs ml-auto"
              onClick={refrescarTodo}
              aria-label="Actualizar"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>

          {subiendo && cargandoAgregar && (
            <p className="text-[11px] text-sky-300">
              Cargando {cargandoAgregar.hecho.toLocaleString("es-PY")} de{" "}
              {cargandoAgregar.total.toLocaleString("es-PY")} contactos…
            </p>
          )}

          {enviando && progreso && (
            <p className="text-[11px] text-amber-300">
              Enviando… {progreso.enviados}/{progreso.total}
              {progreso.errores > 0 ? ` · ${progreso.errores} errores` : ""}
            </p>
          )}
        </div>

        {/* Mensaje de la campaña */}
        <div className="rounded-lg border border-border/40 bg-secondary/20 p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Mensaje</p>
          <p className="text-xs whitespace-pre-wrap">{promocion.mensaje}</p>
          <p className="text-[10px] text-muted-foreground mt-2">
            Vista previa con el primer contacto:{" "}
            <span className="text-foreground">
              “{aplicarVariables(promocion.mensaje, contactos[0] || {})}”
            </span>
          </p>
          {promocion.modoEnvio === "copiar" && (
            <p className="text-[11px] text-sky-300/90 mt-2">
              Copiá el mensaje y pegalo en WhatsApp Web, en tu celular o en ZapFast.
              Al copiarlo, el contacto queda marcado como enviado.
            </p>
          )}
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex gap-1 p-1 rounded-lg glass-card overflow-x-auto">
            {([
              { key: "pendientes", label: `Pendientes (${pendientesCount})` },
              { key: "enviados", label: `Enviados (${enviadosCount})` },
              { key: "problemas", label: `Problemas (${problemasCount})` },
              { key: "todos", label: `Todos (${totales.todos})` },
            ] as { key: Tab; label: string }[]).map((t) => (
              <Button
                key={t.key}
                size="sm"
                variant={tab === t.key ? "default" : "ghost"}
                className="text-[11px] shrink-0 h-7"
                onClick={() => { setTab(t.key); setPagina(0); }}
              >
                {t.label}
              </Button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar nombre, teléfono o modelo…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9 glass-card h-9"
            />
          </div>
        </div>

        {/* Lista de contactos */}
        <div className="space-y-1.5">
          {isLoading && (
            <div className="space-y-1.5">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
          )}

          {!isLoading && contactos.length === 0 && (
            <div className="rounded-lg border border-dashed border-border/40 p-6 text-center">
              <p className="text-xs text-muted-foreground">No hay contactos en esta vista.</p>
            </div>
          )}

          {contactos.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 rounded-lg border border-border/40 bg-secondary/20 px-2.5 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-xs font-medium truncate">{c.nombre}</p>
                  <Badge variant="outline" className={`text-[9px] ${ESTADOS_CONTACTO[c.estado]?.badge || ""}`}>
                    {ESTADOS_CONTACTO[c.estado]?.label || c.estado}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">
                  {fmtPhone(c.telefono)}
                  {c.modelo ? ` · ${c.modelo}` : ""}
                  {c.localidad ? ` · ${c.localidad}` : ""}
                  {c.estado === "error" && c.errorDetalle ? ` · ${c.errorDetalle}` : ""}
                </p>
              </div>

              {c.estado === "pendiente" && (
                <>
                  {promocion.modoEnvio === "copiar" ? (
                    <Button
                      size="sm" variant="outline" className="h-7 text-[10px] shrink-0"
                      onClick={() => copiarMensaje(c)}
                    >
                      <Copy className="w-3 h-3 mr-1" /> Copiar
                    </Button>
                  ) : (
                    <Button
                      size="sm" variant="outline" className="h-7 text-[10px] shrink-0"
                      onClick={() => abrirWhatsapp(c)}
                    >
                      <MessageCircle className="w-3 h-3 mr-1" /> WhatsApp
                    </Button>
                  )}
                  <Button
                    size="sm" variant="ghost" className="h-7 px-2 text-[10px] shrink-0"
                    onClick={() => cambiarEstado(c, "enviado")}
                    title="Marcar como enviado sin abrir WhatsApp"
                  >
                    ✓
                  </Button>
                </>
              )}

              {c.estado === "enviado" && (
                <Button
                  size="sm" variant="ghost" className="h-7 text-[10px] shrink-0 text-muted-foreground"
                  onClick={() => cambiarEstado(c, "pendiente")}
                  title="Volver a pendiente"
                >
                  Deshacer
                </Button>
              )}

              {c.estado === "error" && (
                <Button
                  size="sm" variant="outline" className="h-7 text-[10px] shrink-0"
                  onClick={() => cambiarEstado(c, "pendiente")}
                >
                  Reintentar
                </Button>
              )}
            </div>
          ))}

          {!isLoading && totalFiltrado > 0 && (
            <div className="flex items-center justify-between gap-2 pt-2">
              <p className="text-[10px] text-muted-foreground">
                Mostrando {pagina * LIMITE + 1}–{pagina * LIMITE + contactos.length} de {totalFiltrado}
              </p>
              <div className="flex gap-1.5">
                <Button
                  size="sm" variant="outline" className="h-7 text-[10px]"
                  disabled={pagina === 0}
                  onClick={() => setPagina((p) => Math.max(0, p - 1))}
                >
                  Anterior
                </Button>
                <Button
                  size="sm" variant="outline" className="h-7 text-[10px]"
                  disabled={pagina * LIMITE + contactos.length >= totalFiltrado}
                  onClick={() => setPagina((p) => p + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
