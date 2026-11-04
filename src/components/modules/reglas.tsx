"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit2, Trash2, BookOpen, Clock, Save, Mail, Users, Layers } from "lucide-react";
import { toast } from "sonner";
import { VARIABLES_PLANTILLA, VARIABLES_AGRUPADAS } from "@/lib/permisos";

export function ReglasModule() {
  const [showVars, setShowVars] = useState(false);

  return (
    <div className="space-y-4">
      <Card className="glass-card p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="font-semibold mb-1">Motor de Reglas de Notificación</p>
            <p className="text-sm text-muted-foreground">
              Define estrategias de cobro basadas en días de vencimiento. El sistema arma el mensaje automáticamente:
              <strong> Cabecera + Detalle (por cuota) + Pie dinámico</strong> según atraso.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowVars(true)} className="shrink-0">
            <BookOpen className="w-3.5 h-3.5 mr-1" /> Variables
          </Button>
        </div>
      </Card>

      <Tabs defaultValue="agrupada" className="space-y-4">
        <TabsList className="glass-card flex-wrap h-auto">
          <TabsTrigger value="agrupada"><Mail className="w-3.5 h-3.5 mr-1.5" /> Template Agrupada</TabsTrigger>
          <TabsTrigger value="pie_cliente"><Layers className="w-3.5 h-3.5 mr-1.5" /> Pie Cliente</TabsTrigger>
          <TabsTrigger value="codeudor"><Users className="w-3.5 h-3.5 mr-1.5" /> Template Codeudor</TabsTrigger>
          <TabsTrigger value="pie_codeudor"><Layers className="w-3.5 h-3.5 mr-1.5" /> Pie Codeudor</TabsTrigger>
        </TabsList>

        <TabsContent value="agrupada"><TemplateAgrupadaTab /></TabsContent>
        <TabsContent value="pie_cliente"><ReglasPieTab tipo="pie_cliente" titulo="Reglas del Pie para Clientes" /></TabsContent>
        <TabsContent value="codeudor"><TemplateCodeudorTab /></TabsContent>
        <TabsContent value="pie_codeudor"><ReglasPieTab tipo="pie_codeudor" titulo="Reglas del Pie para Codeudores" /></TabsContent>
      </Tabs>

      <Dialog open={showVars} onOpenChange={setShowVars}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>📖 Variables Disponibles</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground mb-3">
            Usa estas variables entre llaves en tus mensajes. Se reemplazarán automáticamente con los datos del cliente/cuota.
          </p>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-emerald-400 mb-1.5">📋 Para Cabecera / Pie (info del cliente)</p>
              <div className="space-y-1">
                {VARIABLES_AGRUPADAS.filter(v => ["{Entidad}", "{Total Gs}", "{Cantidad Cuotas}", "{Vendedor}", "{Sucursal}"].includes(v.key)).map((v) => (
                  <div key={v.key} className="flex items-center justify-between bg-secondary/40 rounded p-1.5 text-xs">
                    <code className="text-primary font-mono">{v.key}</code>
                    <span className="text-muted-foreground">{v.desc}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-sky-400 mb-1.5">📋 Para Detalle (info de cada cuota)</p>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {VARIABLES_PLANTILLA.map((v) => (
                  <div key={v.key} className="flex items-center justify-between bg-secondary/40 rounded p-1.5 text-xs">
                    <code className="text-primary font-mono">{v.key}</code>
                    <span className="text-muted-foreground">{v.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// TAB: TEMPLATE AGRUPADA
// ============================================================

function TemplateAgrupadaTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["template-agrupada"],
    queryFn: async () => {
      const r = await fetch("/api/templates/agrupada");
      if (!r.ok) throw new Error();
      return r.json();
    },
  });
  const t = data?.template;
  const [form, setForm] = useState<any>(null);

  const save = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/templates/agrupada", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["template-agrupada"] }); toast.success("Template agrupada guardada ✓"); },
    onError: () => toast.error("Error al guardar"),
  });

  // Sync form cuando data carga (no en render para evitar loops)
  useState(() => { if (t && !form) setForm(t); });

  if (isLoading || !t) return <Skeleton className="h-96" />;
  if (!form) setForm(t);

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Mail className="w-4 h-4" /> 📨 Template de Notificación Agrupada
        </CardTitle>
        <p className="text-xs text-muted-foreground">Se usa cuando envías todas las cuotas de un cliente en un solo mensaje</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-xs font-semibold">Cabecera (saludo + total)</Label>
            <span className="text-[10px] text-muted-foreground">Variables: {"{Entidad}"}, {"{Total Gs}"}</span>
          </div>
          <Textarea
            value={form?.cabecera ?? ""}
            onChange={(e) => setForm({ ...form, cabecera: e.target.value })}
            rows={2}
            placeholder="Estimado/a {Entidad} tiene cuotas activas..."
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-xs font-semibold">Detalle (se repite por cada cuota)</Label>
            <span className="text-[10px] text-muted-foreground">Variables: {"{Fecha Vcto}"}, {"{Saldo en Gs}"}, {"{Dias Atrasado}"}</span>
          </div>
          <Textarea
            value={form?.detalle ?? ""}
            onChange={(e) => setForm({ ...form, detalle: e.target.value })}
            rows={2}
            placeholder="- Vcto: {Fecha Vcto} · Saldo: ₲ {Saldo en Gs} · Atraso: {Dias Atrasado} días"
          />
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
          <div>
            <p className="text-sm font-medium">Usar reglas dinámicas para el cuerpo</p>
            <p className="text-xs text-muted-foreground">Cada cuota usará el pie según su rango de días de atraso</p>
          </div>
          <Switch
            checked={form?.usarReglasDinamicas ?? true}
            onCheckedChange={(v) => setForm({ ...form, usarReglasDinamicas: v })}
          />
        </div>

        <Button onClick={() => save.mutate()} disabled={save.isPending} className="glow-primary">
          <Save className="w-4 h-4 mr-1" /> {save.isPending ? "Guardando…" : "💾 Guardar Template"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================
// TAB: TEMPLATE CODEUDOR
// ============================================================

function TemplateCodeudorTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["template-codeudor"],
    queryFn: async () => {
      const r = await fetch("/api/templates/codeudor");
      if (!r.ok) throw new Error();
      return r.json();
    },
  });
  const t = data?.template;
  const [form, setForm] = useState<any>(null);

  const save = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/templates/codeudor", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["template-codeudor"] }); toast.success("Template codeudor guardada ✓"); },
    onError: () => toast.error("Error al guardar"),
  });

  useState(() => { if (t && !form) setForm(t); });
  if (isLoading || !t) return <Skeleton className="h-96" />;
  if (!form) setForm(t);

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Users className="w-4 h-4" /> 👤 Template de Notificación a Codeudores
        </CardTitle>
        <p className="text-xs text-muted-foreground">Se usa cuando envías notificaciones a los codeudores de las cuotas</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs font-semibold">Cabecera (saludo al codeudor)</Label>
          <Textarea
            value={form?.cabecera ?? ""}
            onChange={(e) => setForm({ ...form, cabecera: e.target.value })}
            rows={2}
            placeholder="Estimado/a codeudor, le informamos que el cliente {Entidad}..."
          />
        </div>

        <div>
          <Label className="text-xs font-semibold">Detalle (se repite por cada cuota)</Label>
          <Textarea
            value={form?.detalle ?? ""}
            onChange={(e) => setForm({ ...form, detalle: e.target.value })}
            rows={2}
            placeholder="- Vcto: {Fecha Vcto} · Saldo: ₲ {Saldo en Gs} · Atraso: {Dias Atrasado} días"
          />
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
          <div>
            <p className="text-sm font-medium">Usar reglas dinámicas para el pie</p>
            <p className="text-xs text-muted-foreground">Pie seleccionado según días de atraso (codeudor)</p>
          </div>
          <Switch
            checked={form?.usarReglasDinamicas ?? true}
            onCheckedChange={(v) => setForm({ ...form, usarReglasDinamicas: v })}
          />
        </div>

        <Button onClick={() => save.mutate()} disabled={save.isPending} className="glow-primary">
          <Save className="w-4 h-4 mr-1" /> {save.isPending ? "Guardando…" : "💾 Guardar Template"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================
// TAB: REGLAS DE PIE (cliente o codeudor)
// ============================================================

function ReglasPieTab({ tipo, titulo }: { tipo: "pie_cliente" | "pie_codeudor"; titulo: string }) {
  const [editing, setEditing] = useState<any | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["reglas", tipo],
    queryFn: async () => {
      const r = await fetch(`/api/reglas?tipo=${tipo}`);
      if (!r.ok) throw new Error();
      return r.json();
    },
  });

  const reglas = (data?.reglas || []).slice().sort((a: any, b: any) => (a.ordenPie ?? 0) - (b.ordenPie ?? 0));

  return (
    <div className="space-y-3">
      <Card className="glass-card p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm flex items-center gap-2">
              <Layers className="w-4 h-4" /> 📋 {titulo}
            </p>
            <p className="text-xs text-muted-foreground">El pie se selecciona automáticamente según la cuota con mayor atraso</p>
          </div>
          <Button onClick={() => setEditing({})} size="sm" className="glow-primary">
            <Plus className="w-3.5 h-3.5 mr-1" /> Nueva Regla de Pie
          </Button>
        </div>
      </Card>

      <div className="space-y-2">
        {isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        {!isLoading && reglas.length === 0 && (
          <Card className="glass-card p-6 text-center">
            <Layers className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">No hay reglas de pie configuradas.</p>
          </Card>
        )}
        {reglas.map((r: any) => (
          <ReglaPieCard key={r.id} regla={r} onEdit={() => setEditing(r)} />
        ))}
      </div>

      {editing && <ReglaPieDialog regla={editing} tipo={tipo} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ReglaPieCard({ regla, onEdit }: { regla: any; onEdit: () => void }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/reglas/${regla.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reglas", regla.tipo] });
      toast.success("Regla eliminada");
    },
  });

  const toggle = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/reglas/${regla.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...regla, activa: !regla.activa }),
      });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reglas", regla.tipo] }),
  });

  const rangoLabel = regla.diasMaxPie === -1
    ? `${regla.diasMinPie}+ días`
    : `${regla.diasMinPie} - ${regla.diasMaxPie} días`;

  return (
    <Card className={`glass-card p-3 ${!regla.activa ? "opacity-50" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-semibold text-sm truncate">{regla.nombre}</p>
            <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">{rangoLabel}</Badge>
            {regla.ordenPie != null && <Badge variant="outline" className="text-[10px]">#{regla.ordenPie}</Badge>}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-3">{regla.mensaje}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Switch checked={regla.activa} onCheckedChange={() => toggle.mutate()} />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del.mutate()}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ReglaPieDialog({ regla, tipo, onClose }: { regla: any; tipo: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    nombre: regla.nombre || "",
    mensaje: regla.mensaje || "",
    diasMinPie: regla.diasMinPie ?? 0,
    diasMaxPie: regla.diasMaxPie ?? 5,
    ordenPie: regla.ordenPie ?? 1,
    activa: regla.activa !== false,
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = { ...form, tipo, diasVcto: 0, cooldownDias: 0 };
      if (regla.id) {
        const r = await fetch(`/api/reglas/${regla.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error();
        return r.json();
      } else {
        const r = await fetch("/api/reglas", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error();
        return r.json();
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reglas", tipo] });
      toast.success(regla.id ? "Regla actualizada" : "Regla creada");
      onClose();
    },
    onError: () => toast.error("Error al guardar"),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{regla.id ? "Editar Regla de Pie" : "Nueva Regla de Pie"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nombre de la regla</Label>
            <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Pie - Atraso Moderado (16-30 días)" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Días mínimo</Label>
              <Input type="number" value={form.diasMinPie} onChange={(e) => setForm({ ...form, diasMinPie: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs">Días máximo (-1 = ∞)</Label>
              <Input type="number" value={form.diasMaxPie} onChange={(e) => setForm({ ...form, diasMaxPie: Number(e.target.value) })} />
              <p className="text-[10px] text-muted-foreground mt-1">Usa -1 para "90+ días"</p>
            </div>
            <div>
              <Label className="text-xs">Orden</Label>
              <Input type="number" value={form.ordenPie} onChange={(e) => setForm({ ...form, ordenPie: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Mensaje del pie</Label>
            <Textarea
              value={form.mensaje}
              onChange={(e) => setForm({ ...form, mensaje: e.target.value })}
              rows={5}
              placeholder="Mensaje que se agregará al final..."
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.activa} onCheckedChange={(v) => setForm({ ...form, activa: v })} id="pie-activa" />
            <Label htmlFor="pie-activa" className="text-xs cursor-pointer">Regla activa</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.nombre || !form.mensaje}>
            {save.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// TAB: REGLAS INDIVIDUALES (para una cuota específica)
// ============================================================

function ReglasIndividualesTab() {
  const [editing, setEditing] = useState<any | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["reglas", "individual"],
    queryFn: async () => {
      const r = await fetch("/api/reglas?tipo=individual");
      if (!r.ok) throw new Error();
      return r.json();
    },
  });

  const reglas = data?.reglas || [];

  return (
    <div className="space-y-3">
      <Card className="glass-card p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" /> ⏰ Reglas Individuales (una cuota)
            </p>
            <p className="text-xs text-muted-foreground">Para envíos de una cuota específica según días al vencimiento</p>
          </div>
          <Button onClick={() => setEditing({})} size="sm" className="glow-primary">
            <Plus className="w-3.5 h-3.5 mr-1" /> Nueva Regla
          </Button>
        </div>
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        {!isLoading && reglas.map((r: any) => (
          <ReglaIndividualCard key={r.id} regla={r} onEdit={() => setEditing(r)} />
        ))}
      </div>

      {editing && <ReglaIndividualDialog regla={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ReglaIndividualCard({ regla, onEdit }: { regla: any; onEdit: () => void }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/reglas/${regla.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reglas", "individual"] }); toast.success("Regla eliminada"); },
  });

  const diasLabel = regla.diasVcto < 0 ? `${Math.abs(regla.diasVcto)} días antes` :
    regla.diasVcto === 0 ? "Día exacto" : `${regla.diasVcto} días después`;
  const color = regla.diasVcto < 0 ? "text-emerald-400 bg-emerald-500/10" :
    regla.diasVcto === 0 ? "text-sky-400 bg-sky-500/10" :
    regla.diasVcto <= 30 ? "text-amber-400 bg-amber-500/10" : "text-red-400 bg-red-500/10";

  return (
    <Card className="glass-card p-4 flex flex-col">
      <div className="flex items-start justify-between mb-2">
        <p className="font-semibold truncate flex-1">{regla.nombre}</p>
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}><Edit2 className="w-3.5 h-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del.mutate()}><Trash2 className="w-3.5 h-3.5" /></Button>
        </div>
      </div>
      <Badge variant="outline" className={`text-[10px] self-start mb-2 ${color}`}>{diasLabel}</Badge>
      <p className="text-xs text-muted-foreground line-clamp-3 flex-1">{regla.mensaje}</p>
    </Card>
  );
}

function ReglaIndividualDialog({ regla, onClose }: { regla: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    nombre: regla.nombre || "",
    diasVcto: regla.diasVcto ?? 0,
    mensaje: regla.mensaje || "",
    activa: regla.activa !== false,
    cooldownDias: regla.cooldownDias ?? 3,
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = { ...form, tipo: "individual" };
      if (regla.id) {
        const r = await fetch(`/api/reglas/${regla.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error();
        return r.json();
      } else {
        const r = await fetch("/api/reglas", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error();
        return r.json();
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reglas", "individual"] });
      toast.success(regla.id ? "Regla actualizada" : "Regla creada");
      onClose();
    },
    onError: () => toast.error("Error al guardar"),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{regla.id ? "Editar Regla Individual" : "Nueva Regla Individual"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nombre</Label>
            <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Vencida 30 días" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Días respecto al vencimiento</Label>
              <Input type="number" value={form.diasVcto} onChange={(e) => setForm({ ...form, diasVcto: Number(e.target.value) })} />
              <p className="text-[10px] text-muted-foreground mt-1">-3 = antes, 0 = día exacto, +7 = después</p>
            </div>
            <div>
              <Label className="text-xs">Cooldown (días)</Label>
              <Input type="number" value={form.cooldownDias} onChange={(e) => setForm({ ...form, cooldownDias: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Mensaje (usa variables entre llaves)</Label>
            <Textarea value={form.mensaje} onChange={(e) => setForm({ ...form, mensaje: e.target.value })} rows={4} placeholder="Hola {Entidad}, su cuota de ₲ {Saldo en Gs}..." />
          </div>
          <div className="flex flex-wrap gap-1">
            {VARIABLES_PLANTILLA.slice(0, 10).map((v) => (
              <button key={v.key} type="button" className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/60 text-primary hover:bg-secondary"
                onClick={() => setForm({ ...form, mensaje: form.mensaje + " " + v.key })}>
                {v.key}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.activa} onCheckedChange={(v) => setForm({ ...form, activa: v })} id="ind-activa" />
            <Label htmlFor="ind-activa" className="text-xs cursor-pointer">Regla activa</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.nombre || !form.mensaje}>
            {save.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
