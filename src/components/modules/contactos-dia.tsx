"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, Users, Calendar, RefreshCw, TrendingUp } from "lucide-react";
import { fmtPhone, fmtRelative } from "@/lib/format";

export function ContactosDiaModule() {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["contactos-dia", fecha],
    queryFn: async () => {
      const r = await fetch(`/api/contactos-dia?fecha=${fecha}`);
      if (!r.ok) throw new Error();
      return r.json();
    },
  });

  const porUsuario = data?.porUsuario || [];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 glass-card rounded-lg px-3 py-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="border-0 bg-transparent p-0 h-6 w-32" />
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Actualizar
        </Button>
        <div className="ml-auto">
          <Card className="glass-card px-4 py-2 inline-flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-sm">Total contactados:</span>
            <span className="text-lg font-bold text-primary">{data?.total || 0}</span>
          </Card>
        </div>
      </div>

      {/* Resumen por usuario */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        {!isLoading && porUsuario.length === 0 && (
          <Card className="glass-card p-6 text-center sm:col-span-2 lg:col-span-4">
            <Users className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">Aún no hay contactos registrados en esta fecha.</p>
          </Card>
        )}
        {!isLoading && porUsuario.map((grupo: any, i: number) => (
          <Card key={i} className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-semibold">
                {grupo.usuario?.nombre?.[0]?.toUpperCase() || "?"}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{grupo.usuario?.nombre}</p>
                <p className="text-[10px] text-muted-foreground">{grupo.usuario?.login}</p>
              </div>
            </div>
            <p className="text-2xl font-bold text-primary">{grupo.total}</p>
            <p className="text-[10px] text-muted-foreground uppercase">personas contactadas</p>
          </Card>
        ))}
      </div>

      {/* Detalle */}
      {porUsuario.length > 0 && (
        <div className="space-y-3">
          {porUsuario.map((grupo: any, i: number) => (
            <Card key={i} className="glass-card overflow-hidden">
              <div className="p-3 border-b border-border/40 bg-secondary/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <p className="font-semibold text-sm">{grupo.usuario?.nombre}</p>
                  </div>
                  <Badge variant="secondary">{grupo.total} contactos</Badge>
                </div>
              </div>
              <div className="divide-y divide-border/20 max-h-60 overflow-y-auto">
                {grupo.contactos.map((c: any) => (
                  <div key={c.id} className="p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Phone className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.cliente?.entidad || "Cliente desconocido"}</p>
                      <p className="text-xs text-muted-foreground">{fmtPhone(c.telefono)} · {fmtRelative(c.fecha)}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize">{c.tipo}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
