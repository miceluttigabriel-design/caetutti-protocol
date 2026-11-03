"use client";

import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2, Loader2, FileJson } from "lucide-react";
import { toast } from "sonner";

const CHUNK_SIZE = 200; // filas por lote — evita timeout de Vercel

export function ImportarModule() {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [resultado, setResultado] = useState<any | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [importando, setImportando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // === IMPORTACIÓN POR LOTES (chunks) ===
  // Divide el archivo en lotes de 200 filas y los envía uno por uno.
  // Esto evita el timeout de Vercel con archivos grandes (1000+ filas).
  const importarArchivo = async () => {
    if (!file) {
      toast.error("Selecciona un archivo");
      return;
    }

    setImportando(true);
    setProgress(null);
    setResultado(null);

    try {
      // === 1. Leer el archivo y convertir a filas ===
      let allRows: any[] = [];

      if (file.name.toLowerCase().endsWith(".json")) {
        // JSON
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          allRows = parsed;
        } else if (parsed.clientes && Array.isArray(parsed.clientes)) {
          allRows = parsed.clientes;
        } else {
          throw new Error("JSON inválido. Debe ser array o { clientes: [...] }");
        }
      } else {
        // Excel
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        allRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      }

      if (allRows.length === 0) {
        throw new Error("El archivo está vacío");
      }

      console.log(`[import] Total filas leídas: ${allRows.length}`);

      // === 2. Dividir en lotes ===
      const lotes: any[][] = [];
      for (let i = 0; i < allRows.length; i += CHUNK_SIZE) {
        lotes.push(allRows.slice(i, i + CHUNK_SIZE));
      }

      console.log(`[import] Total lotes: ${lotes.length} (${CHUNK_SIZE} filas por lote)`);
      setProgress({ current: 0, total: lotes.length });

      // === 3. Enviar cada lote ===
      const resultadoTotal = {
        clientesNuevos: 0,
        clientesActualizados: 0,
        cuotasProcesadas: 0,
        marcadasCobradas: 0,
        cuotasMarcadasCobradas: 0,
        codeudoresNuevos: 0,
        sucursalesCreadas: 0,
        errores: [] as string[],
        advertencias: [] as string[],
      };

      for (let i = 0; i < lotes.length; i++) {
        setProgress({ current: i + 1, total: lotes.length });

        const fd = new FormData();
        fd.append(
          "file",
          new File(
            [JSON.stringify({ clientes: lotes[i] })],
            `lote-${i + 1}.json`,
            { type: "application/json" }
          )
        );

        const r = await fetch("/api/import", { method: "POST", body: fd });

        if (!r.ok) {
          let errMsg = `Error HTTP ${r.status}`;
          try {
            const errData = await r.json();
            errMsg = errData.error || errMsg;
          } catch {}
          throw new Error(`Lote ${i + 1}/${lotes.length}: ${errMsg}`);
        }

        const data = await r.json();
        const res = data.result;

        // Acumular resultados
        if (res) {
          resultadoTotal.clientesNuevos += res.clientesNuevos || 0;
          resultadoTotal.clientesActualizados += res.clientesActualizados || 0;
          resultadoTotal.cuotasProcesadas += res.cuotasProcesadas || 0;
          resultadoTotal.marcadasCobradas += res.marcadasCobradas || 0;
          resultadoTotal.cuotasMarcadasCobradas += res.cuotasMarcadasCobradas || 0;
          resultadoTotal.codeudoresNuevos += res.codeudoresNuevos || 0;
          resultadoTotal.sucursalesCreadas += res.sucursalesCreadas || 0;
          if (res.errores?.length) resultadoTotal.errores.push(...res.errores);
          if (res.advertencias?.length) resultadoTotal.advertencias.push(...res.advertencias);
        }
      }

      // === 4. Mostrar resultado final ===
      setResultado(resultadoTotal);
      toast.success(
        `Importación completada: ${resultadoTotal.cuotasProcesadas} cuotas en ${lotes.length} lote(s)`
      );
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["cuotas"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["notifs"] });
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (e: any) {
      console.error("[import] Error:", e);
      toast.error(e.message || "Error al importar");
    } finally {
      setImportando(false);
      setProgress(null);
    }
  };

  const descargarPlantilla = () => {
    window.location.href = "/api/import/template";
  };

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }

  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-3 gap-3">
        {/* Upload area */}
        <Card className="glass-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Upload className="w-4 h-4" /> Importar Datos
            </CardTitle>
            <p className="text-xs text-muted-foreground">Carga clientes y cuotas desde archivos JSON o Excel</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                dragOver ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.json"
                onChange={handleSelect}
                className="hidden"
              />
              {file ? (
                <div>
                  <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 text-primary" />
                  <p className="font-semibold text-sm">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <Upload className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">Arrastra tu archivo aquí</p>
                  <p className="text-xs text-muted-foreground mt-1">o haz clic para seleccionar</p>
                  <p className="text-[10px] text-muted-foreground mt-3">Formatos: .xlsx, .xls, .json · Máx 5,000 filas</p>
                </div>
              )}
            </div>

            {/* Barra de progreso para importación por lotes */}
            {progress && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-primary">
                    Importando lote {progress.current} de {progress.total}...
                  </span>
                  <span className="text-muted-foreground">
                    {Math.round((progress.current / progress.total) * 100)}%
                  </span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={importarArchivo}
                disabled={!file || importando}
                className="flex-1 glow-primary"
              >
                {importando ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importando por lotes…</>
                ) : (
                  <><Upload className="w-4 h-4 mr-2" /> Importar Archivo</>
                )}
              </Button>
              <Button variant="outline" onClick={descargarPlantilla}>
                <Download className="w-4 h-4 mr-2" /> Plantilla Excel
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Info card */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <FileJson className="w-4 h-4" /> Formatos Soportados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-semibold text-xs mb-1">📊 Excel (.xlsx)</p>
              <p className="text-xs text-muted-foreground">Usa la plantilla descargable. Cada fila = 1 cuota. El sistema crea/actualiza clientes automáticamente.</p>
            </div>
            <div>
              <p className="font-semibold text-xs mb-1">📄 JSON</p>
              <p className="text-xs text-muted-foreground">Formato estructurado con clientes y cuotas anidadas, o array plano (igual que Excel).</p>
            </div>
            <div className="pt-2 border-t border-border/40">
              <p className="text-[10px] text-muted-foreground">
                💡 <strong>Tip:</strong> El campo <code className="text-primary">Codigo Entidad</code> es la clave. Si existe, se actualiza; si no, se crea.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resultado */}
      {resultado && (
        <Card className="glass-card border-emerald-500/30">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" /> Importación Completada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
              <Stat label="Clientes nuevos" value={resultado.clientesNuevos} color="text-emerald-400" />
              <Stat label="Actualizados" value={resultado.clientesActualizados} color="text-sky-400" />
              <Stat label="Cuotas procesadas" value={resultado.cuotasProcesadas} color="text-primary" />
              <Stat label="Marcadas cobradas" value={resultado.marcadasCobradas + (resultado.cuotasMarcadasCobradas || 0)} color="text-violet-400" />
              <Stat label="No vinieron (cobradas)" value={resultado.cuotasMarcadasCobradas || 0} color="text-orange-400" />
              <Stat label="Sucursales creadas" value={resultado.sucursalesCreadas || 0} color="text-amber-400" />
            </div>

            {resultado.advertencias?.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-sky-400 flex items-center gap-1 mb-2">
                  <AlertCircle className="w-3.5 h-3.5" /> {resultado.advertencias.length} advertencia(s)
                </p>
                <div className="max-h-24 overflow-y-auto space-y-1 bg-sky-500/5 rounded-lg p-2 border border-sky-500/20">
                  {resultado.advertencias.map((adv: string, i: number) => (
                    <p key={i} className="text-[11px] text-sky-300/80 font-mono">{adv}</p>
                  ))}
                </div>
              </div>
            )}

            {resultado.errores?.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-amber-400 flex items-center gap-1 mb-2">
                  <AlertCircle className="w-3.5 h-3.5" /> {resultado.errores.length} errores (algunas filas no se procesaron)
                </p>
                <div className="max-h-32 overflow-y-auto space-y-1 bg-amber-500/5 rounded-lg p-2 border border-amber-500/20">
                  {resultado.errores.slice(0, 20).map((err: string, i: number) => (
                    <p key={i} className="text-[11px] text-amber-300/80 font-mono">{err}</p>
                  ))}
                  {resultado.errores.length > 20 && (
                    <p className="text-[10px] text-muted-foreground">... y {resultado.errores.length - 20} más</p>
                  )}
                </div>
              </div>
            )}

            <Button variant="outline" size="sm" onClick={() => setResultado(null)}>
              Cerrar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Matriz de campos */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-sm">📋 Matriz de Campos de Importación</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border/40">
                <tr>
                  <th className="text-left px-2 py-2 font-medium text-muted-foreground">Campo</th>
                  <th className="text-left px-2 py-2 font-medium text-muted-foreground">Tipo</th>
                  <th className="text-left px-2 py-2 font-medium text-muted-foreground">Requerido</th>
                  <th className="text-left px-2 py-2 font-medium text-muted-foreground">Descripción</th>
                </tr>
              </thead>
              <tbody>
                {CAMPOS.map((c) => (
                  <tr key={c.campo} className="border-b border-border/20">
                    <td className="px-2 py-1.5 font-mono">{c.campo}</td>
                    <td className="px-2 py-1.5">{c.tipo}</td>
                    <td className="px-2 py-1.5">
                      <Badge variant={c.req === "Sí" ? "default" : "outline"} className="text-[10px]">{c.req}</Badge>
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">{c.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg bg-secondary/40 p-3 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}

const CAMPOS = [
  // === DATOS DEL CLIENTE ===
  { campo: "Codigo Entidad", tipo: "Texto/Número", req: "Sí", desc: "🔑 CLAVE ÚNICA del cliente. Si existe → actualiza, si no → crea." },
  { campo: "Entidad", tipo: "Texto", req: "Sí", desc: "Nombre completo del cliente" },
  { campo: "Ci Entidad", tipo: "Texto", req: "No", desc: "Cédula de identidad" },
  { campo: "Ruc Entidad", tipo: "Texto", req: "No", desc: "RUC del cliente" },
  { campo: "Telefono", tipo: "Texto", req: "No", desc: "Teléfono principal. Se normaliza: 0986101358, 985506942 → 0985506942, 47230482 → 047230482" },
  { campo: "Telefono_pivot", tipo: "Texto", req: "No", desc: "Teléfono alternativo (mismo formato)" },
  { campo: "Localidad", tipo: "Texto", req: "No", desc: "Ciudad o localidad" },
  { campo: "Vendedor", tipo: "Texto", req: "No", desc: "Formato: '52813 - NOMBRE'. Se parsea automáticamente para extraer solo el nombre." },
  { campo: "Cobrador", tipo: "Texto", req: "No", desc: "Nombre del cobrador asignado" },
  { campo: "Sucursal", tipo: "Texto", req: "No", desc: "Sucursal donde se originó. Se crea automáticamente si no existe." },
  { campo: "Judicial", tipo: "SI/NO", req: "No", desc: "SI o NO. Se normaliza a S/N." },
  { campo: "Informconf", tipo: "SI/NO", req: "No", desc: "SI o NO. Se normaliza a S/N." },
  // === DATOS DE LA CUOTA (deuda) ===
  { campo: "Fecha Vcto", tipo: "Fecha", req: "Sí", desc: "Fecha de vencimiento. Acepta Excel serial (44993) o YYYY-MM-DD." },
  { campo: "Fecha Emision", tipo: "Fecha", req: "No", desc: "Fecha de emisión. Acepta Excel serial o YYYY-MM-DD." },
  { campo: "Saldo en Gs", tipo: "Número", req: "Sí", desc: "Saldo pendiente en Guaraníes. Si es 0, se marca como cobrada." },
  { campo: "Saldo Guarani", tipo: "Número", req: "No", desc: "Saldo adicional en Guaraníes" },
  { campo: "Saldo Dolar", tipo: "Número", req: "No", desc: "Saldo en dólares (si aplica)" },
  { campo: "Venc Mes", tipo: "Número", req: "No", desc: "Monto original del mes" },
  { campo: "Moneda", tipo: "Texto", req: "No", desc: "GS, USD, etc. (default: GS)" },
  { campo: "Dias Atrasado", tipo: "Número", req: "No", desc: "Días de atraso respecto al vencimiento" },
  { campo: "Mes Vcto", tipo: "Texto/Número", req: "No", desc: "Formato: '15-APRIL' o número 1-12. Se parsea automáticamente." },
  { campo: "Ano Vcto", tipo: "Número", req: "No", desc: "Año de vencimiento (4 dígitos)" },
  // === IGNORADOS ===
  { campo: "Tipo Prox Contacto", tipo: "—", req: "—", desc: "⚠ Se descarta en la importación" },
  { campo: "Pago Mes", tipo: "—", req: "—", desc: "⚠ Se descarta en la importación" },
  { campo: "Saldo Real", tipo: "—", req: "—", desc: "⚠ Se descarta (se recalcula)" },
  { campo: "Mes Emision", tipo: "—", req: "—", desc: "⚠ Se descarta (se calcula de Fecha Emision)" },
  { campo: "Ano Emision", tipo: "—", req: "—", desc: "⚠ Se descarta (se calcula de Fecha Emision)" },
  { campo: "Ult Comentario", tipo: "—", req: "—", desc: "⚠ Se descarta en la importación" },
  { campo: "Fecha Prox Contacto", tipo: "—", req: "—", desc: "⚠ Se descarta en la importación" },
];
