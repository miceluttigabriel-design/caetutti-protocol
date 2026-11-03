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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit2, Trash2, Users, Shield, Key } from "lucide-react";
import { fmtRelative } from "@/lib/format";
import { PERMISOS, permisosByGrupo } from "@/lib/permisos";
import { toast } from "sonner";

export function AdminUsuariosModule() {
  return (
    <Tabs defaultValue="usuarios">
      <TabsList className="glass-card">
        <TabsTrigger value="usuarios"><Users className="w-3.5 h-3.5 mr-1" /> Usuarios</TabsTrigger>
        <TabsTrigger value="grupos"><Shield className="w-3.5 h-3.5 mr-1" /> Grupos</TabsTrigger>
      </TabsList>
      <TabsContent value="usuarios"><UsuariosTab /></TabsContent>
      <TabsContent value="grupos"><GruposTab /></TabsContent>
    </Tabs>
  );
}

function UsuariosTab() {
  const [editing, setEditing] = useState<any | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-usuarios"],
    queryFn: async () => {
      const r = await fetch("/api/admin/usuarios");
      if (!r.ok) throw new Error();
      return r.json();
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setShowCreate(true)} className="glow-primary">
          <Plus className="w-4 h-4 mr-1" /> Nuevo Usuario
        </Button>
      </div>

      <Card className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/40 bg-secondary/30">
              <tr>
                <th className="text-left px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground font-medium">Usuario</th>
                <th className="text-left px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground font-medium">Grupo</th>
                <th className="text-left px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground font-medium">Último login</th>
                <th className="text-center px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground font-medium">Estado</th>
                <th className="text-center px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 3 }).map((_, i) => <tr key={i}><td colSpan={5} className="p-3"><Skeleton className="h-6" /></td></tr>)}
              {(data?.usuarios || []).map((u: any) => (
                <tr key={u.id} className="border-b border-border/20 hover:bg-secondary/30">
                  <td className="px-3 py-2.5">
                    <p className="font-medium">{u.nombre}</p>
                    <p className="text-[10px] text-muted-foreground">{u.login} · {u.email}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    {u.grupo ? (
                      <Badge variant="outline" className={u.grupo.esAdmin ? "text-violet-300 border-violet-500/30" : ""}>
                        {u.grupo.esAdmin && "👑 "}{u.grupo.nombre}
                      </Badge>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {u.ultimoLogin ? fmtRelative(u.ultimoLogin) : "Nunca"}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {u.activo ? (
                      <Badge className="bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20 text-[10px]">✓ Activo</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px]">Inactivo</Badge>
                    )}
                    {u.debeCambiarPass && <Badge variant="outline" className="text-amber-400 ml-1 text-[10px]">⚠ Cambio</Badge>}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(u)}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
              {!isLoading && !data?.usuarios?.length && (
                <tr><td colSpan={5} className="text-center py-8 text-muted-foreground text-sm">No hay usuarios.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {(editing || showCreate) && (
        <UsuarioDialog usuario={editing} onClose={() => { setEditing(null); setShowCreate(false); }} />
      )}
    </div>
  );
}

function UsuarioDialog({ usuario, onClose }: { usuario: any | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-usuarios"],
    queryFn: async () => {
      const r = await fetch("/api/admin/usuarios");
      return r.json();
    },
  });
  const grupos = data?.grupos || [];
  const sucursales = data?.sucursales || [];

  const [form, setForm] = useState({
    login: usuario?.login || "",
    nombre: usuario?.nombre || "",
    email: usuario?.email || "",
    telefono: usuario?.telefono || "",
    password: "",
    rol: usuario?.rol || "usuario",
    grupoId: usuario?.grupoId || "",
    debeCambiarPass: usuario?.debeCambiarPass ?? true,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (usuario) {
        // Edit: not implemented in API for now
        toast.info("Edición de usuarios próximamente");
        return;
      }
      const r = await fetch("/api/admin/usuarios", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          grupoId: form.grupoId || undefined,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Error");
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-usuarios"] }); toast.success("Usuario creado"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{usuario ? "Editar Usuario" : "Nuevo Usuario"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Login *</Label>
            <Input value={form.login} onChange={(e) => setForm({...form, login: e.target.value})} disabled={!!usuario} />
          </div>
          <div>
            <Label className="text-xs">Nombre completo *</Label>
            <Input value={form.nombre} onChange={(e) => setForm({...form, nombre: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} />
            </div>
            <div>
              <Label className="text-xs">Teléfono</Label>
              <Input value={form.telefono} onChange={(e) => setForm({...form, telefono: e.target.value})} />
            </div>
          </div>
          {!usuario && (
            <div>
              <Label className="text-xs">Contraseña *</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Rol</Label>
              <select value={form.rol} onChange={(e) => setForm({...form, rol: e.target.value})} className="w-full glass-card rounded-lg px-3 py-2 text-sm">
                <option value="usuario">Usuario</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Grupo</Label>
              <select value={form.grupoId} onChange={(e) => setForm({...form, grupoId: e.target.value})} className="w-full glass-card rounded-lg px-3 py-2 text-sm">
                <option value="">Sin grupo</option>
                {grupos.map((g: any) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.debeCambiarPass} onCheckedChange={(v) => setForm({...form, debeCambiarPass: v})} id="cambio-pass" />
            <Label htmlFor="cambio-pass" className="text-xs cursor-pointer">Forzar cambio de contraseña en próximo login</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || (!usuario && (!form.login || !form.nombre || !form.password))}>
            {save.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GruposTab() {
  const [showCreate, setShowCreate] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-grupos"],
    queryFn: async () => {
      const r = await fetch("/api/admin/grupos");
      if (!r.ok) throw new Error();
      return r.json();
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setShowCreate(true)} className="glow-primary">
          <Plus className="w-4 h-4 mr-1" /> Nuevo Grupo
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        {(data?.grupos || []).map((g: any) => <GrupoCard key={g.id} grupo={g} />)}
      </div>

      {showCreate && <GrupoDialog onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function GrupoCard({ grupo }: { grupo: any }) {
  let permisos: string[] = [];
  try { permisos = JSON.parse(grupo.permisos || "[]"); } catch {}
  const grupos = permisosByGrupo();

  return (
    <Card className="glass-card p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-semibold flex items-center gap-2">
            {grupo.esAdmin && <span>👑</span>} {grupo.nombre}
          </p>
          <p className="text-xs text-muted-foreground">{grupo.descripcion || "—"}</p>
        </div>
        <Badge variant="outline" className="text-xs">{grupo._count?.usuarios || 0} usuarios</Badge>
      </div>
      <div className="space-y-1.5">
        {grupo.esAdmin ? (
          <p className="text-xs text-violet-400">Acceso total (admin)</p>
        ) : permisos.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin permisos</p>
        ) : (
          Object.entries(grupos).map(([gn, gp]) => {
            const selected = gp.filter((p) => permisos.includes(p.key));
            if (!selected.length) return null;
            return (
              <div key={gn} className="text-xs">
                <p className="text-muted-foreground uppercase tracking-wider text-[10px]">{gn}</p>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {selected.map((p) => <Badge key={p.key} variant="secondary" className="text-[10px]">{p.label}</Badge>)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

function GrupoDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [esAdmin, setEsAdmin] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const grupos = permisosByGrupo();

  const save = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/admin/grupos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre, descripcion,
          permisos: esAdmin ? ["*"] : selected,
          esAdmin,
        }),
      });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-grupos"] }); toast.success("Grupo creado"); onClose(); },
    onError: () => toast.error("Error al crear"),
  });

  function toggle(k: string) {
    setSelected(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nuevo Grupo</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[65vh] overflow-y-auto">
          <div>
            <Label className="text-xs">Nombre *</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Descripción</Label>
            <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={esAdmin} onCheckedChange={setEsAdmin} id="es-admin" />
            <Label htmlFor="es-admin" className="text-xs cursor-pointer">Grupo administrador (acceso total)</Label>
          </div>

          {!esAdmin && (
            <div>
              <Label className="text-xs">Permisos</Label>
              <div className="space-y-3 mt-2">
                {Object.entries(grupos).map(([gn, gp]) => (
                  <div key={gn}>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">{gn}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {gp.map((p) => (
                        <label key={p.key} className="flex items-center gap-2 text-xs cursor-pointer p-1.5 rounded hover:bg-secondary/40">
                          <input
                            type="checkbox"
                            checked={selected.includes(p.key)}
                            onChange={() => toggle(p.key)}
                            className="accent-primary"
                          />
                          {p.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !nombre}>
            {save.isPending ? "Guardando…" : "Crear Grupo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
