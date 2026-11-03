"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Wallet, Users, Bell, Clock, AlertTriangle, Target, CheckCircle2 } from "lucide-react";
import { fmtGs, fmtGsShort, fmtNumber, fmtPct } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

const PIE_COLORS = ["#10b981", "#f59e0b", "#f97316", "#ef4444", "#dc2626", "#7f1d1d"];

export function DashboardPage({ sucursal }: { sucursal: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", sucursal],
    queryFn: async () => {
      const r = await fetch(`/api/dashboard?sucursal=${encodeURIComponent(sucursal)}`);
      if (!r.ok) throw new Error();
      return r.json();
    },
    refetchInterval: 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  const { kpis, buckets } = data;

  const bucketData = buckets.map((b: any) => ({
    name: b.label,
    monto: Math.round(b.monto / 1_000_000),
    count: b.count,
  }));

  const pieData = buckets
    .filter((b: any) => b.count > 0)
    .map((b: any) => ({ name: b.label, value: b.count, monto: b.monto }));

  const tasaCobranzaPct = Math.max(0, Math.min(100, kpis.tasaCobranza));
  const saludColor =
    tasaCobranzaPct >= 85 ? "text-emerald-400" :
    tasaCobranzaPct >= 70 ? "text-amber-400" : "text-red-400";

  return (
    <div className="space-y-4">
      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<Wallet className="w-4 h-4" />}
          label="Total Pendiente (con interés)"
          value={fmtGs(kpis.totalPendiente)}
          sublabel={`Interés: ${fmtGs(kpis.totalInteres || 0)}`}
          accent="primary"
        />
        <KpiCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Tasa de Cobranza"
          value={fmtPct(tasaCobranzaPct)}
          sublabel={`sobre ${fmtGsShort(kpis.totalVendido)} vendido`}
          accent={tasaCobranzaPct >= 85 ? "emerald" : tasaCobranzaPct >= 70 ? "amber" : "red"}
        />
        <KpiCard
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Crítico (+30 días)"
          value={fmtGsShort(kpis.totalCritico)}
          sublabel="requiere acción urgente"
          accent="red"
        />
        <KpiCard
          icon={<Users className="w-4 h-4" />}
          label="Clientes Activos"
          value={fmtNumber(kpis.totalClientes)}
          sublabel={`${kpis.sinNotificar} sin notificar`}
          accent="sky"
        />
      </div>

      {/* Health bar */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Salud de Cobranza</p>
              <p className={`text-2xl font-bold ${saludColor}`}>{fmtPct(tasaCobranzaPct)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Cobrado</p>
              <p className="text-sm font-semibold text-emerald-400">
                {fmtGsShort(kpis.totalVendido - kpis.totalPendiente)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Pendiente</p>
              <p className="text-sm font-semibold text-amber-400">{fmtGsShort(kpis.totalPendiente)}</p>
            </div>
          </div>
          <Progress value={tasaCobranzaPct} className="h-2" />
          <p className="text-[10px] text-muted-foreground mt-1.5">
            {tasaCobranzaPct >= 85 ? "✓ Saludable" : tasaCobranzaPct >= 70 ? "⚠ Atenção requerida" : "⚠ Crítico"}
          </p>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">📊 Distribución por Antigüedad de Deuda</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={bucketData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.21 0.015 240)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [`₲ ${value}M`, "Monto"]}
                />
                <Bar dataKey="monto" radius={[6, 6, 0, 0]}>
                  {bucketData.map((_: any, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">🥧 Cuotas por Tramo</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={40}
                  paddingAngle={2}
                >
                  {pieData.map((_: any, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.21 0.015 240)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number, _name: string, entry: any) => [
                    `${fmtNumber(value)} cuotas · ${fmtGsShort(entry.payload.monto)}`,
                    entry.payload.name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Resumen operativo */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniStat
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          label="Notificadas"
          value={fmtNumber(kpis.notificadas)}
        />
        <MiniStat
          icon={<Bell className="w-4 h-4 text-amber-400" />}
          label="Sin Notificar"
          value={fmtNumber(kpis.sinNotificar)}
        />
        <MiniStat
          icon={<Clock className="w-4 h-4 text-sky-400" />}
          label="Recordatorios"
          value={fmtNumber(kpis.recordatoriosPendientes)}
        />
        <MiniStat
          icon={<Target className="w-4 h-4 text-violet-400" />}
          label="Notifs. Enviadas"
          value={fmtNumber(kpis.notificacionesEnviadas)}
        />
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, sublabel, accent }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel?: string;
  accent: "primary" | "emerald" | "amber" | "red" | "sky" | "violet";
}) {
  const accentMap: Record<string, string> = {
    primary: "text-primary bg-primary/10",
    emerald: "text-emerald-400 bg-emerald-500/10",
    amber: "text-amber-400 bg-amber-500/10",
    red: "text-red-400 bg-red-500/10",
    sky: "text-sky-400 bg-sky-500/10",
    violet: "text-violet-400 bg-violet-500/10",
  };
  return (
    <Card className="glass-card overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
          <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${accentMap[accent]}`}>
            {icon}
          </span>
        </div>
        <p className="text-2xl font-bold leading-none">{value}</p>
        {sublabel && <p className="text-[11px] text-muted-foreground mt-1.5">{sublabel}</p>}
      </CardContent>
    </Card>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="glass-card">
      <CardContent className="p-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-secondary/60 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold leading-none">{value}</p>
          <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
