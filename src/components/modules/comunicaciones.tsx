"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, MessageCircle, RefreshCw, X, Bot, Clock, History } from "lucide-react";
import { fmtRelative, fmtPhone } from "@/lib/format";
import { toast } from "sonner";

export function ComunicacionesModule() {
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<"chat" | "ia" | "historial">("chat");
  const qc = useQueryClient();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["conversaciones"],
    queryFn: async () => {
      const r = await fetch("/api/conversaciones?estado=activa");
      if (!r.ok) throw new Error();
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const convs = data?.conversaciones || [];
  const current = selected ? convs.find((c: any) => c.id === selected) : null;

  // Auto-select first conversation
  useEffect(() => {
    if (!selected && convs.length > 0) setSelected(convs[0].id);
  }, [convs, selected]);

  // Cargar mensajes de la conversación seleccionada
  const { data: convData } = useQuery({
    queryKey: ["conv", current?.telefono],
    queryFn: async () => {
      if (!current?.telefono) return null;
      const r = await fetch(`/api/conversaciones/${current.telefono}`);
      if (!r.ok) throw new Error();
      return r.json();
    },
    enabled: !!current?.telefono,
    refetchInterval: 10_000,
  });

  const send = useMutation({
    mutationFn: async () => {
      if (!current || !message.trim()) return;
      const r = await fetch("/api/conversaciones", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telefono: current.telefono,
          clienteId: current.clienteId,
          nombreWa: current.nombreWa,
          contenido: message.trim(),
        }),
      });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => {
      setMessage("");
      qc.invalidateQueries({ queryKey: ["conv", current?.telefono] });
      qc.invalidateQueries({ queryKey: ["conversaciones"] });
    },
    onError: () => toast.error("Error al enviar mensaje"),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-1 rounded-lg glass-card">
          <Button variant={tab === "chat" ? "default" : "ghost"} size="sm" onClick={() => setTab("chat")}>
            <MessageCircle className="w-3.5 h-3.5 mr-1" /> Conversación
          </Button>
          <Button variant={tab === "ia" ? "default" : "ghost"} size="sm" onClick={() => setTab("ia")}>
            <Bot className="w-3.5 h-3.5 mr-1" /> Resumen IA
          </Button>
          <Button variant={tab === "historial" ? "default" : "ghost"} size="sm" onClick={() => setTab("historial")}>
            <History className="w-3.5 h-3.5 mr-1" /> Historial
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Actualizar
        </Button>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-3 h-[calc(100vh-220px)]">
        {/* Lista conversaciones */}
        <Card className="glass-card overflow-hidden flex flex-col">
          <div className="p-3 border-b border-border/40">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Conversaciones Activas ({convs.length})
            </p>
          </div>
          <ScrollArea className="flex-1">
            {isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 m-2" />)}
            {!isLoading && convs.length === 0 && (
              <div className="p-6 text-center text-xs text-muted-foreground">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No hay conversaciones activas.
                <p className="mt-1">Aparecerán cuando envíes o recibas mensajes.</p>
              </div>
            )}
            {convs.map((c: any) => (
              <button
                key={c.id}
                onClick={() => setSelected(c.id)}
                className={`w-full text-left p-3 border-b border-border/20 hover:bg-secondary/40 transition-colors ${
                  selected === c.id ? "bg-primary/10" : ""
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                    {c.nombreWa?.[0]?.toUpperCase() || c.cliente?.entidad?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {c.nombreWa || c.cliente?.entidad || fmtPhone(c.telefono)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{fmtPhone(c.telefono)}</p>
                  </div>
                  {c.noLeidos > 0 && (
                    <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5">{c.noLeidos}</Badge>
                  )}
                </div>
                {c.ultimoMensaje && (
                  <p className="text-[10px] text-muted-foreground">{fmtRelative(c.ultimoMensaje)}</p>
                )}
              </button>
            ))}
          </ScrollArea>
        </Card>

        {/* Panel principal */}
        {current ? (
          <Card className="glass-card flex flex-col overflow-hidden">
            {tab === "chat" && (
              <ChatPanel
                conv={convData?.conversacion || current}
                message={message}
                setMessage={setMessage}
                onSend={() => send.mutate()}
                sending={send.isPending}
              />
            )}
            {tab === "ia" && <IAPanel conv={convData?.conversacion || current} />}
            {tab === "historial" && <HistorialPanel telefono={current.telefono} />}
          </Card>
        ) : (
          <Card className="glass-card flex items-center justify-center text-center p-8">
            <div>
              <MessageCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">Selecciona una conversación para empezar</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function ChatPanel({ conv, message, setMessage, onSend, sending }: any) {
  const mensajes = conv?.mensajes || [];
  return (
    <>
      <div className="p-3 border-b border-border/40 flex items-center justify-between">
        <div>
          <p className="font-semibold text-sm">{conv?.cliente?.entidad || conv?.nombreWa || fmtPhone(conv?.telefono)}</p>
          <p className="text-[10px] text-muted-foreground">{fmtPhone(conv?.telefono)}</p>
        </div>
        <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-[10px]">
          ● Activa
        </Badge>
      </div>
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-2">
          {mensajes.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-6">No hay mensajes en esta conversación</p>
          )}
          {mensajes.map((m: any) => (
            <div key={m.id} className={`flex ${m.esEntrante ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                m.esEntrante
                  ? "bg-secondary/60"
                  : "bg-primary text-primary-foreground"
              }`}>
                {m.tipo === "audio" && (
                  <div className="flex items-center gap-2">
                    <Bot className="w-3.5 h-3.5" />
                    <span className="text-xs">Audio {m.transcripcion && "(transcrito)"}</span>
                  </div>
                )}
                <p className="whitespace-pre-wrap">{m.contenido}</p>
                {m.transcripcion && (
                  <p className="text-[10px] opacity-70 mt-1 italic">"{m.transcripcion}"</p>
                )}
                <p className="text-[10px] opacity-50 mt-0.5">{new Date(m.createdAt).toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="p-3 border-t border-border/40 flex gap-2">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder="Escribe un mensaje…"
          disabled={sending}
        />
        <Button onClick={onSend} disabled={sending || !message.trim()} className="glow-primary">
          {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </>
  );
}

function IAPanel({ conv }: any) {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-violet-500/15 text-violet-400 flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold">Resumen con IA</p>
            <p className="text-xs text-muted-foreground">Análisis automático de la conversación</p>
          </div>
        </div>

        {conv?.resumenIA ? (
          <Card className="glass-card p-4">
            <p className="text-sm whitespace-pre-wrap">{conv.resumenIA}</p>
          </Card>
        ) : (
          <Card className="glass-card p-6 text-center">
            <Bot className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground mb-3">
              Aún no hay resumen generado para esta conversación.
            </p>
            <Button variant="outline" disabled>
              <Bot className="w-3.5 h-3.5 mr-1.5" /> Generar resumen (próximamente)
            </Button>
          </Card>
        )}

        {conv?.compromisoDetectado && (
          <Card className="glass-card p-4 border-emerald-500/30">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-emerald-400" />
              <p className="font-semibold text-sm text-emerald-400">Compromiso de Pago Detectado</p>
            </div>
            <p className="text-sm">
              El cliente comprometió pago para: <strong>{conv.fechaCompromiso ? new Date(conv.fechaCompromiso).toLocaleDateString("es-PY") : "—"}</strong>
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

function HistorialPanel({ telefono }: { telefono: string }) {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <Card className="glass-card p-6 text-center">
        <History className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-50" />
        <p className="text-sm text-muted-foreground">
          Historial completo de conversación con <strong>{fmtPhone(telefono)}</strong>
        </p>
        <p className="text-xs text-muted-foreground mt-1">Próximamente: filtros por fecha y búsqueda.</p>
      </Card>
    </div>
  );
}
