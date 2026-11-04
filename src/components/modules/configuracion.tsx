"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Key, MessageSquare, Bot, Brain, AlertTriangle, ExternalLink, CheckCircle2, XCircle, Plus, Trash2, Zap, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { fmtGs } from "@/lib/format";

export function ConfiguracionModule() {
  return (
    <Tabs defaultValue="general" className="space-y-4">
      <TabsList className="glass-card flex-wrap h-auto">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
        <TabsTrigger value="uso">Uso y Límites</TabsTrigger>
        <TabsTrigger value="plantillas">Plantillas</TabsTrigger>
        <TabsTrigger value="ia">IA</TabsTrigger>
      </TabsList>

      <TabsContent value="general"><GeneralTab /></TabsContent>
      <TabsContent value="whatsapp"><WhatsAppTab /></TabsContent>
      <TabsContent value="uso"><UsoTab /></TabsContent>
      <TabsContent value="plantillas"><PlantillasTab /></TabsContent>
      <TabsContent value="ia"><IATab /></TabsContent>
    </Tabs>
  );
}

function useConfig() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["config"],
    queryFn: async () => {
      const r = await fetch("/api/config");
      if (!r.ok) throw new Error();
      return r.json();
    },
  });
  return { config: data?.config, whatsapp: data?.whatsapp, isLoading, refetch };
}

function GeneralTab() {
  const { config, isLoading } = useConfig();
  const [form, setForm] = useState<any>(null);
  const [borrando, setBorrando] = useState(false);
  const [showConfirmBorrar, setShowConfirmBorrar] = useState(false);
  const qc = useQueryClient();

  useEffect(() => { if (config && !form) setForm(config); }, [config]);

  const save = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/config", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["config"] }); toast.success("Configuración guardada"); },
    onError: () => toast.error("Error al guardar"),
  });

  const borrarDeudas = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/deudas/borrar-todas?confirmar=true", { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json()).error || "Error");
      return r.json();
    },
    onSuccess: (data: any) => {
      toast.success(data.mensaje || "Deudas borradas");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["cuotas"] });
      qc.invalidateQueries({ queryKey: ["notifs"] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      setShowConfirmBorrar(false);
    },
    onError: (e: any) => toast.error(e.message || "Error al borrar"),
  });

  if (isLoading || !form) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-3">
      <Card className="glass-card">
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Key className="w-4 h-4" /> Contraseña y Cooldown</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Contraseña por defecto (usuarios nuevos)</Label>
            <Input value={form.defaultPassword} onChange={(e) => setForm({...form, defaultPassword: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Cooldown Clientes (días)</Label>
              <Input type="number" value={form.cooldownClientes} onChange={(e) => setForm({...form, cooldownClientes: Number(e.target.value)})} />
            </div>
            <div>
              <Label className="text-xs">Cooldown Codeudores (días)</Label>
              <Input type="number" value={form.cooldownCodeudores} onChange={(e) => setForm({...form, cooldownCodeudores: Number(e.target.value)})} />
            </div>
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="glow-primary">
            <Save className="w-4 h-4 mr-1" /> {save.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </CardContent>
      </Card>

      {/* === ZONA PELIGROSA (movida desde la pestaña Automatización, ahora eliminada) === */}
      <Card className="glass-card border-red-500/30">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2 text-red-400">
            <Trash2 className="w-4 h-4" /> 🗑️ Zona Peligrosa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-sm font-semibold text-red-300 mb-1">Borrar TODAS las deudas</p>
            <p className="text-xs text-muted-foreground mb-2">
              Elimina todas las deudas (cuotas), notificaciones, conversaciones y logs de la empresa.
              <strong className="text-emerald-400"> Los clientes se PRESERVAN.</strong> Esta acción es irreversible.
            </p>
            <p className="text-[10px] text-muted-foreground">
              Útil cuando necesitas re-importar datos actualizados sin duplicar deudas antiguas.
            </p>
          </div>

          {!showConfirmBorrar ? (
            <Button
              variant="outline"
              className="text-red-400 border-red-500/30 hover:bg-red-500/10"
              onClick={() => setShowConfirmBorrar(true)}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Borrar todas las deudas
            </Button>
          ) : (
            <div className="space-y-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <p className="text-xs text-red-300 font-semibold">⚠️ ¿Confirmar borrado de TODAS las deudas?</p>
              <p className="text-[10px] text-muted-foreground">
                Se borrarán: cuotas, notificaciones, conversaciones, contactos del día y logs.
                Los <strong className="text-emerald-400">clientes se preservan</strong>.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={borrando || borrarDeudas.isPending}
                  onClick={() => borrarDeudas.mutate()}
                >
                  {borrarDeudas.isPending ? "Borrando…" : "✓ Sí, borrar todo"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowConfirmBorrar(false)}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function WhatsAppTab() {
  const { config, isLoading, refetch } = useConfig();
  const [form, setForm] = useState<any>(null);
  const qc = useQueryClient();
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (config && !form) {
      // Forzar proveedor = datafy siempre
      setForm({ ...config, whatsappProveedor: "datafy" });
    }
  }, [config]);

  const save = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/config", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsappProveedor: "datafy", // siempre datafy
          datafyApiKey: form.datafyApiKey,
          datafyChannelId: form.datafyChannelId,
          datafyChannelName: form.datafyChannelName,
          datafyPhoneNumber: form.datafyPhoneNumber,
          datafyBaseUrl: form.datafyBaseUrl,
        }),
      });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["config"] }); toast.success("Configuración Datafy guardada"); },
    onError: () => toast.error("Error al guardar"),
  });

  const testConnection = async () => {
    setTesting(true);
    try {
      const r = await fetch("/api/whatsapp/status");
      const data = await r.json();
      if (data.conectado) {
        toast.success(`✓ Conectado: ${data.channelName || data.phoneNumber || "canal activo"}`);
      } else {
        toast.error(`✗ No conectado: ${data.error || "verifica las credenciales"}`);
      }
      refetch();
    } catch {
      toast.error("Error al verificar conexión");
    } finally {
      setTesting(false);
    }
  };

  if (isLoading || !form) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-3">
      {/* Banner de ayuda */}
      <Card className="glass-card border-emerald-500/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="flex-1 text-sm">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <p className="font-semibold">Datafy — WhatsApp Business API</p>
                <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">PARTNER OFICIAL META</Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Tu canal ya está conectado al dashboard de Datafy. Solo necesitás la API Key y el Channel ID.
                {" "}
                <a href="https://datafy.com.br" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-0.5">
                  datafy.com.br <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuración Datafy */}
      <Card className="glass-card">
        <CardHeader><CardTitle className="text-sm">📋 Credenciales Datafy</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
            <p className="font-semibold mb-1">📋 ¿Dónde consigo los datos?</p>
            <ol className="list-decimal ml-4 space-y-0.5 text-amber-300/80">
              <li><strong>API Key</strong> → Datafy → Documentação ou Configurações → API</li>
              <li><strong>Channel ID</strong> → Click en "Ver detalhes" del canal "Viza Home Micelutti"</li>
              <li><strong>Webhook URL</strong> → Configurá esta URL en Datafy → Webhooks</li>
            </ol>
          </div>

          <div>
            <Label className="text-xs">Datafy API Key *</Label>
            <Input
              type="password"
              value={form.datafyApiKey || ""}
              onChange={(e) => setForm({...form, datafyApiKey: e.target.value})}
              placeholder="dfk_..."
              className="font-mono"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Channel ID *</Label>
              <Input
                value={form.datafyChannelId || ""}
                onChange={(e) => setForm({...form, datafyChannelId: e.target.value})}
                placeholder="240889396847645"
                className="font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">Nombre del canal (display)</Label>
              <Input
                value={form.datafyChannelName || ""}
                onChange={(e) => setForm({...form, datafyChannelName: e.target.value})}
                placeholder="Viza Home Micelutti"
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Número conectado</Label>
              <Input
                value={form.datafyPhoneNumber || ""}
                onChange={(e) => setForm({...form, datafyPhoneNumber: e.target.value})}
                placeholder="+595 981 123 456"
              />
            </div>
            <div>
              <Label className="text-xs">URL base de la API</Label>
              <Input
                value={form.datafyBaseUrl || "https://api.datafy.com.br/v1"}
                onChange={(e) => setForm({...form, datafyBaseUrl: e.target.value})}
                className="font-mono text-xs"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Webhook URL pública (configurar en Datafy)</Label>
            <Input readOnly value={typeof window !== "undefined" ? `${window.location.origin}/api/whatsapp/webhook` : "/api/whatsapp/webhook"} className="font-mono text-xs" />
            <p className="text-[10px] text-muted-foreground mt-1">
              Copiá esta URL en Datafy → Webhooks → New Webhook.
              Eventos a suscribir: <code className="text-primary">message.received</code>, <code className="text-primary">message.status</code>
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="glow-primary">
              <Save className="w-4 h-4 mr-1" /> {save.isPending ? "Guardando…" : "Guardar credenciales"}
            </Button>
            <Button variant="outline" onClick={testConnection} disabled={testing || !form.datafyApiKey}>
              {testing ? <><span className="animate-spin mr-1">⏳</span> Verificando…</> : <><CheckCircle2 className="w-4 h-4 mr-1" /> Probar conexión</>}
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground mt-2">
            ⏱ Tu trial de Datafy expira en 6 días. Configurá todo ahora y probá antes que termine.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function UsoTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["whatsapp-uso"],
    queryFn: async () => {
      const r = await fetch("/api/whatsapp/uso");
      if (!r.ok) throw new Error();
      return r.json();
    },
  });
  const qc = useQueryClient();
  const { config } = useConfig();
  const [limite, setLimite] = useState<number>(50);
  const [bloquear, setBloquear] = useState(true);

  useEffect(() => {
    if (config) {
      setLimite(config.metaLimiteMensualUsd || 50);
      setBloquear(config.metaBloquearAlLimite !== false);
    }
  }, [config]);

  const saveLimite = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/whatsapp/uso", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metaLimiteMensualUsd: limite,
          metaBloquearAlLimite: bloquear,
        }),
      });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp-uso"] });
      qc.invalidateQueries({ queryKey: ["config"] });
      toast.success("Límite actualizado");
    },
  });

  if (isLoading || !data) return <Skeleton className="h-64" />;

  const { actual, limite: lim, costosReferencia, historico } = data;
  const porcentaje = lim.porcentajeUsado;
  const colorBar = porcentaje >= 100 ? "destructive" : porcentaje >= lim.alertaEnPorcentaje ? "amber" : "primary";

  return (
    <div className="space-y-3">
      {/* Card de costo actual */}
      <Card className="glass-card">
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Uso del Mes Actual ({actual.mes})</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg bg-secondary/40 p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Costo actual</p>
              <p className={`text-xl font-bold ${porcentaje >= 100 ? "text-red-400" : "text-amber-400"}`}>${actual.costoEstimadoUsd.toFixed(4)}</p>
            </div>
            <div className="rounded-lg bg-secondary/40 p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Límite mensual</p>
              <p className="text-xl font-bold text-emerald-400">${lim.mensualUsd.toFixed(2)}</p>
            </div>
            <div className="rounded-lg bg-secondary/40 p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Restante</p>
              <p className="text-xl font-bold text-sky-400">${lim.restanteUsd.toFixed(2)}</p>
            </div>
            <div className="rounded-lg bg-secondary/40 p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Estado</p>
              {actual.bloqueado ? (
                <Badge variant="destructive" className="mt-1">🔒 Bloqueado</Badge>
              ) : porcentaje >= lim.alertaEnPorcentaje ? (
                <Badge className="bg-amber-500/20 text-amber-300 mt-1">⚠ Cerca del límite</Badge>
              ) : (
                <Badge className="bg-emerald-500/20 text-emerald-300 mt-1">✓ Disponible</Badge>
              )}
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>Progreso del límite</span>
              <span className={porcentaje >= 100 ? "text-red-400" : porcentaje >= 80 ? "text-amber-400" : "text-emerald-400"}>
                {porcentaje.toFixed(1)}%
              </span>
            </div>
            <Progress value={Math.min(100, porcentaje)} className={`h-2 ${porcentaje >= 100 ? "[&>div]:bg-red-500" : porcentaje >= 80 ? "[&>div]:bg-amber-500" : ""}`} />
          </div>

          {/* Detalle por categoría */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Mensajes enviados por categoría</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <div className="flex items-center justify-between bg-secondary/40 p-2 rounded">
                <span className="text-xs">UTILITY (cobranza)</span>
                <Badge variant="secondary">{actual.enviadosUtility}</Badge>
              </div>
              <div className="flex items-center justify-between bg-secondary/40 p-2 rounded">
                <span className="text-xs">MARKETING</span>
                <Badge variant="secondary">{actual.enviadosMarketing}</Badge>
              </div>
              <div className="flex items-center justify-between bg-secondary/40 p-2 rounded">
                <span className="text-xs">SERVICE (24h)</span>
                <Badge variant="secondary">{actual.enviadosService}</Badge>
              </div>
              <div className="flex items-center justify-between bg-secondary/40 p-2 rounded">
                <span className="text-xs">Recibidos</span>
                <Badge variant="secondary">{actual.recibidos}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configurar límite */}
      <Card className="glass-card">
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4" /> Configurar Límite Mensual</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Límite mensual (USD)</Label>
              <Input type="number" step="0.01" value={limite} onChange={(e) => setLimite(Number(e.target.value))} />
              <p className="text-[10px] text-muted-foreground mt-1">Tope de gasto mensual. Ej: $50 = ~2,200 mensajes de cobranza</p>
            </div>
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-2">
                <Switch checked={bloquear} onCheckedChange={setBloquear} id="bloquear" />
                <Label htmlFor="bloquear" className="text-xs cursor-pointer">Bloquear envíos al llegar al límite</Label>
              </div>
            </div>
          </div>
          <Button onClick={() => saveLimite.mutate()} disabled={saveLimite.isPending} className="glow-primary">
            <Save className="w-4 h-4 mr-1" /> {saveLimite.isPending ? "Guardando…" : "Guardar límite"}
          </Button>
        </CardContent>
      </Card>

      {/* Costos referenciales */}
      <Card className="glass-card">
        <CardHeader><CardTitle className="text-sm">💲 Costos Referenciales (Paraguay)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {costosReferencia.map((c: any) => (
              <div key={c.categoria} className="bg-secondary/40 p-2 rounded text-center">
                <p className="text-muted-foreground">{c.categoria}</p>
                <p className="font-semibold">${c.costoUsd.toFixed(4)}</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            * Costo por conversación iniciada por negocio. Primeras 1,000 conversaciones de servicio por mes son GRATIS.
          </p>
        </CardContent>
      </Card>

      {/* Histórico */}
      {historico.length > 0 && (
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-sm">📊 Histórico (últimos 6 meses)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {historico.map((h: any) => (
                <div key={h.mes} className="flex items-center justify-between bg-secondary/40 p-2 rounded text-xs">
                  <span className="font-mono">{h.mes}</span>
                  <span>{h.enviados} envíos ({h.fallidos} fallidos)</span>
                  <span className="font-semibold">${h.costo.toFixed(4)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PlantillasTab() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["meta-templates"],
    queryFn: async () => {
      const r = await fetch("/api/whatsapp/templates");
      if (!r.ok) throw new Error();
      return r.json();
    },
  });

  return (
    <div className="space-y-3">
      <Card className="glass-card border-amber-500/30">
        <CardContent className="p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-amber-400">Importante sobre Plantillas de Meta</p>
            <p className="text-muted-foreground">
              Para enviar mensajes de cobranza (fuera de la ventana de 24h), Meta requiere usar plantillas pre-aprobadas.
              Las plantillas <strong>UTILITY</strong> (cobranza, notificaciones de cuenta) se aprueban automáticamente en minutos.
              Las variables se definen con <code className="text-primary">{`{{1}}`}</code>, <code className="text-primary">{`{{2}}`}</code>, etc.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => setShowCreate(true)} className="glow-primary">
          <Plus className="w-4 h-4 mr-1" /> Nueva Plantilla
        </Button>
      </div>

      <div className="space-y-2">
        {isLoading && <Skeleton className="h-24" />}
        {!isLoading && (data?.templates || []).length === 0 && (
          <Card className="glass-card p-8 text-center">
            <MessageSquare className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">No hay plantillas creadas.</p>
          </Card>
        )}
        {!isLoading && (data?.templates || []).map((t: any) => <TemplateCard key={t.id} template={t} />)}
      </div>

      {showCreate && <TemplateDialog onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function TemplateCard({ template: t }: { template: any }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/whatsapp/templates/${t.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meta-templates"] }); toast.success("Plantilla eliminada"); },
  });

  const catColor = t.categoria === "UTILITY" ? "text-emerald-400 bg-emerald-500/10" : "text-amber-400 bg-amber-500/10";
  const estadoColor = t.estado === "aprobada" ? "text-emerald-400" : t.estado === "rechazada" ? "text-red-400" : "text-amber-400";

  return (
    <Card className="glass-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold font-mono text-sm">{t.metaNombre}</p>
            <Badge variant="outline" className={`text-[10px] ${catColor}`}>{t.categoria}</Badge>
            <Badge variant="outline" className={`text-[10px] ${estadoColor}`}>
              {t.estado === "aprobada" ? "✓ Aprobada" : t.estado === "rechazada" ? "✗ Rechazada" : "⏳ Pendiente"}
            </Badge>
            <Badge variant="outline" className="text-[10px]">{t.idioma}</Badge>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{t.cuerpo}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive" onClick={() => del.mutate()}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </Card>
  );
}

function TemplateDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    nombre: "",
    idioma: "es",
    categoria: "UTILITY",
    cuerpo: "",
  });

  const save = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/whatsapp/templates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Error");
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meta-templates"] }); toast.success("Plantilla creada"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Nueva Plantilla Meta</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nombre (sin espacios, lowercase + _)</Label>
            <Input value={form.nombre} onChange={(e) => setForm({...form, nombre: e.target.value})} placeholder="recordatorio_vencimiento" />
            <p className="text-[10px] text-muted-foreground mt-1">Se sanitiza automáticamente</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Categoría</Label>
              <Select value={form.categoria} onValueChange={(v) => setForm({...form, categoria: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTILITY">UTILITY (cobranza, notif. cuenta)</SelectItem>
                  <SelectItem value="MARKETING">MARKETING (promociones)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Idioma</Label>
              <Select value={form.idioma} onValueChange={(v) => setForm({...form, idioma: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="es">Español (es)</SelectItem>
                  <SelectItem value="en">English (en)</SelectItem>
                  <SelectItem value="pt">Português (pt)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Cuerpo (usa {"{{1}}"}, {"{{2}}"} para variables)</Label>
            <Textarea
              value={form.cuerpo}
              onChange={(e) => setForm({...form, cuerpo: e.target.value})}
              rows={5}
              placeholder="Hola {&#123;1&#125;}, le recordamos que su cuota de ₲ {&#123;2&#125;} vence el {&#123;3&#125;}. Comuníquese al 021 123 456."
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Las variables se reemplazan en orden: {"{{1}}"} = primer valor, {"{{2}}"} = segundo, etc.
            </p>
          </div>

          <div className="p-2 rounded bg-emerald-500/10 text-xs text-emerald-400">
            <p className="font-semibold mb-1">Plantilla de ejemplo para cobranza:</p>
            <p className="font-mono">Hola {`{{1}}`}, le recordamos que su cuota de ₲ {`{{2}}`} con vencimiento {`{{3}}`} está {`{{4}}`}. Regularice su situación llamando al 021 123 456. CobranzasFlow.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.nombre || !form.cuerpo}>
            {save.isPending ? "Guardando…" : "Crear Plantilla"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IATab() {
  const { config, isLoading } = useConfig();
  const [form, setForm] = useState<any>(null);
  const [probando, setProbando] = useState(false);
  const [resultadoPrueba, setResultadoPrueba] = useState<any>(null);
  const qc = useQueryClient();

  useEffect(() => { if (config && !form) setForm(config); }, [config]);

  const save = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/config", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          iaProveedor: form.iaProveedor,
          nvidiaApiKey: form.nvidiaApiKey,
          nvidiaModelo: form.nvidiaModelo,
          geminiApiKey: form.geminiApiKey,
          geminiModelo: form.geminiModelo,
          ollamaUrl: form.ollamaUrl,
          ollamaModelo: form.ollamaModelo,
          transcripcionProveedor: form.transcripcionProveedor,
          iaResumenesActiva: form.iaResumenesActiva,
          iaTranscripcionActiva: form.iaTranscripcionActiva,
        }),
      });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["config"] }); toast.success("Configuración IA guardada ✓"); },
    onError: () => toast.error("Error al guardar"),
  });

  async function probarConexion() {
    setProbando(true);
    setResultadoPrueba(null);
    try {
      // Guardar primero
      await save.mutateAsync();
      // Luego probar
      const r = await fetch("/api/ia/probar", { method: "POST" });
      const data = await r.json();
      setResultadoPrueba(data);
      if (data.ok) {
        toast.success(`✓ Conexión exitosa con ${data.proveedor} (${data.modelo})`);
      } else {
        toast.error(`✗ Error: ${data.mensaje}`);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setProbando(false);
    }
  }

  if (isLoading || !form) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-3">
      {/* Proveedor principal */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" /> Proveedor de IA Principal
          </CardTitle>
          <p className="text-xs text-muted-foreground">Selecciona qué proveedor usar para resúmenes, detección de compromisos y generación de mensajes</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Proveedor</Label>
            <Select value={form.iaProveedor || "nvidia"} onValueChange={(v) => setForm({...form, iaProveedor: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nvidia">🟢 NVIDIA NIM (Gratis — Recomendado)</SelectItem>
                <SelectItem value="gemini">🔵 Google Gemini</SelectItem>
                <SelectItem value="ollama">🟣 Ollama (Local)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
            <div>
              <p className="text-sm font-medium">Activar resúmenes de conversaciones</p>
              <p className="text-xs text-muted-foreground">IA analiza conversaciones y genera resumen + detecta compromisos</p>
            </div>
            <Switch checked={form.iaResumenesActiva ?? true} onCheckedChange={(v) => setForm({...form, iaResumenesActiva: v})} />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
            <div>
              <p className="text-sm font-medium">Detección automática de compromisos</p>
              <p className="text-xs text-muted-foreground">Cuando un cliente diga "mañana pago", crea promesa de pago automáticamente</p>
            </div>
            <Switch checked={form.autoDetectarCompromisos ?? true} onCheckedChange={(v) => setForm({...form, autoDetectarCompromisos: v})} />
          </div>
        </CardContent>
      </Card>

      {/* NVIDIA NIM */}
      {form.iaProveedor === "nvidia" && (
        <Card className="glass-card border-primary/30">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="text-primary">🟢</span> NVIDIA NIM
              <Badge variant="outline" className="text-[10px] text-primary border-primary/30">GRATIS</Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              API OpenAI-compatible. Consigue tu key gratis en{" "}
              <a href="https://build.nvidia.com" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-0.5">
                build.nvidia.com <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">NVIDIA API Key</Label>
              <Input
                type="password"
                value={form.nvidiaApiKey || ""}
                onChange={(e) => setForm({...form, nvidiaApiKey: e.target.value})}
                placeholder="nvapi-..."
                className="font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">Modelo</Label>
              <Input
                value={form.nvidiaModelo || ""}
                onChange={(e) => setForm({...form, nvidiaModelo: e.target.value})}
                placeholder="meta/llama-3.2-11b-vision-instruct"
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Modelos recomendados: meta/llama-3.2-11b-vision-instruct (rápido), nvidia/llama-3.1-nemotron-70b-instruct (potente)
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gemini */}
      {form.iaProveedor === "gemini" && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><span>🔵</span> Google Gemini</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">API Key de Gemini</Label>
              <Input type="password" value={form.geminiApiKey || ""} onChange={(e) => setForm({...form, geminiApiKey: e.target.value})} placeholder="AIza…" />
            </div>
            <div>
              <Label className="text-xs">Modelo</Label>
              <Select value={form.geminiModelo || "gemini-2.5-flash"} onValueChange={(v) => setForm({...form, geminiModelo: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash (Recomendado)</SelectItem>
                  <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                  <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ollama */}
      {form.iaProveedor === "ollama" && (
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Bot className="w-4 h-4" /> Ollama (Local)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">URL de Ollama</Label>
              <Input value={form.ollamaUrl || ""} onChange={(e) => setForm({...form, ollamaUrl: e.target.value})} placeholder="http://localhost:11434" />
            </div>
            <div>
              <Label className="text-xs">Modelo de Ollama</Label>
              <Input value={form.ollamaModelo || ""} onChange={(e) => setForm({...form, ollamaModelo: e.target.value})} placeholder="llama3.2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transcripción de audios (sección abierta para futuro) */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" /> Transcripción de Audios
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Sección abierta — por ahora usa Gemini. Preparado para agregar Whisper, NVIDIA ASR u otros en el futuro.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Activar transcripción de audios recibidos</Label>
            <Switch checked={form.iaTranscripcionActiva} onCheckedChange={(v) => setForm({...form, iaTranscripcionActiva: v})} />
          </div>
          <div>
            <Label className="text-xs">Proveedor de transcripción</Label>
            <Select value={form.transcripcionProveedor || "gemini"} onValueChange={(v) => setForm({...form, transcripcionProveedor: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini">🔵 Google Gemini (actual)</SelectItem>
                <SelectItem value="ninguno">⏸ Ninguno (desactivado)</SelectItem>
                {/* Futuro: <SelectItem value="whisper">Whisper</SelectItem> */}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-1">
              Para usar Gemini necesitás configurar la API Key arriba (aunque el proveedor principal sea NVIDIA)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Botones */}
      <div className="flex gap-2">
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="glow-primary flex-1">
          <Save className="w-4 h-4 mr-1" /> {save.isPending ? "Guardando…" : "💾 Guardar"}
        </Button>
        <Button onClick={probarConexion} disabled={probando} variant="outline" className="flex-1">
          {probando ? <><span className="animate-spin mr-1">⏳</span> Probando…</> : <><CheckCircle2 className="w-4 h-4 mr-1" /> Probar conexión</>}
        </Button>
      </div>

      {/* Resultado de prueba */}
      {resultadoPrueba && (
        <Card className={`glass-card ${resultadoPrueba.ok ? "border-emerald-500/30" : "border-red-500/30"}`}>
          <CardContent className="p-3">
            <div className="flex items-start gap-2">
              {resultadoPrueba.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              )}
              <div className="text-xs">
                <p className="font-semibold">
                  {resultadoPrueba.ok ? "Conexión exitosa" : "Error de conexión"}
                </p>
                <p className="text-muted-foreground mt-0.5 font-mono">{resultadoPrueba.mensaje}</p>
                {resultadoPrueba.ok && (
                  <p className="text-muted-foreground mt-1">
                    Proveedor: <strong>{resultadoPrueba.proveedor}</strong> · Modelo: <strong className="font-mono">{resultadoPrueba.modelo}</strong>
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/*
 * La pestaña "Automatización" fue eliminada a pedido del usuario.
 * Las opciones "Notificaciones automáticas" y "Detección automática de compromisos"
 * se movieron a la pestaña Notificaciones (panel arriba de la lista),
 * y la "Zona Peligrosa" se movió a la pestaña General de esta configuración.
 */
