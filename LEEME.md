# 🎯 FIX ACUMULATIVO: Dashboard Sin Interés + Reglas Mora + Timezone + WhatsApp

## ⭐ NUEVO en esta versión: Dashboard sin interés

### Cambios en los cuadritos (KPI cards) del Dashboard

| Antes | Ahora |
|---|---|
| **Total Pendiente (con interés)** ₲ 1.196.578.276 · *"Interés: ₲ 228.690.829"* | **Saldo Por Cobrar** ₲ 967.887.447 *(sin línea de interés)* |
| **Tasa de Cobranza** 0.0% · *"sobre ₲ 0 vendido"* | **Total % Recuperado del Mes** X.X% · *"₲X cobrado del mes"* |

### Detalle del cambio

1. **KPI 1 "Saldo Por Cobrar"**: ahora suma solo `saldoGs` (sin interés, que no cuadra con el Excel). Se eliminó la sub-línea "Interés: ₲X".

2. **KPI 2 "Total % Recuperado del Mes"**: reemplaza a "Tasa de Cobranza" (que siempre estaba en 0% sobre ₲0 vendido). Ahora muestra el % real recuperado del mes con color dinámico (verde/amarillo/rojo) y sub-línea "₲X cobrado del mes".

3. **Barra de progreso de abajo**: quedó más compacta (sin el título grande duplicado, ya que el % está ahora en el KPI).

4. **API dashboard**:
   - `totalPendiente` = suma de `saldoGs` (no `saldoTotalGs`)
   - `totalVencido`, `totalPorVencer`, `totalCritico`, `buckets[].monto`, `montoPendienteMes` todos con `saldoGs`
   - `totalInteres = 0` (no se muestra)

---

## ⭐ También: Reglas de mensaje por mora (de la versión anterior)

12 reglas (6 titular + 6 codeudor) por rango de días, con el enfoque de que el
cliente consulte el interés por mora con su gestor en línea. Todas terminan con
esa indicación.

---

## ⚠️ PASOS IMPORTANTES después del deploy

Ejecutá estos **2 comandos** en la consola del navegador (F12 → "allow pasting"):

**1) Actualizar los templates con el nuevo pie:**
```js
fetch('/api/admin/reset-mensajes', { method: 'POST' }).then(r => r.json()).then(console.log)
```

**2) Crear las 12 reglas de mora (titular + codeudor):**
```js
fetch('/api/admin/seed-pie-mora', {
  method: 'POST',
  headers: {'Content-Type':'application/json'},
  body: '{}'
}).then(r => r.json()).then(console.log)
```

---

## ✅ Todo lo que incluye este ZIP (acumulativo)

1. **⭐ Dashboard sin interés**: "Saldo Por Cobrar" + "% Recuperado del Mes"
2. **⭐ Reglas por mora**: 12 reglas (titular + codeudor) por rango de días
3. **⭐ Sin interés en Notificaciones**: solo saldo del Excel + días vencidos
4. **Fix timezone**: Vcto y días de atraso correctos (FLEITAS: 01/11, 3d)
5. **WhatsApp directo**: botón Cliente/Codeudor abre wa.me sin bloqueo
6. **Vencidos fuera de POR VENCER**: con cuota vencida → bloque VENCIDOS
7. **Sucursal GLOBAL para Clientes**: sin selector interno
8. **Panel 🤖 Automatización** dentro de Notificaciones
9. **🗑️ Zona Peligrosa** en pestaña General
10. **Pestaña Automatización ELIMINADA** de Configuraciones

---

## 📁 Archivos incluidos (12)

| Archivo | Qué cambia |
|---|---|
| `src/app/api/dashboard/route.ts` | ⭐ totalPendiente = saldoGs, sin interés |
| `src/components/modules/dashboard.tsx` | ⭐ "Saldo Por Cobrar" + "% Recuperado del Mes" en KPI |
| `src/app/api/admin/seed-pie-mora/route.ts` | ⭐ NUEVO: 12 reglas con enfoque mora |
| `src/app/api/admin/reset-mensajes/route.ts` | NUEVO: actualiza templates existentes |
| `src/lib/mensajes.ts` | Saldo sin interés + nuevo pie + fechas UTC |
| `src/app/api/notificaciones/route.ts` | saldoTotalGs=saldoGs + criterio vencidos + días UTC |
| `src/components/modules/notificaciones.tsx` | Sin "+interés" + WhatsApp directo + Vcto correcto |
| `src/lib/format/index.ts` | `fmtDate` usa UTC (fix 31/10 → 01/11) |
| `src/app/api/import/route.ts` | `parseFecha` Excel serial → fecha local |
| `src/components/modules/clientes.tsx` | Vence: usa `fmtDate` + sin selector interno |
| `src/components/dashboard/shell.tsx` | Le pasa la sucursal global a Clientes |
| `src/components/modules/configuracion.tsx` | Sin pestaña Automatización · Zona Peligrosa en General |

## 🔧 Cómo aplicar

1. Abrí la carpeta del repo: `C:\Users\usuario\OneDrive\Documentos\GitHub\viza-home-sistema\caetutti-protocol`
2. Copiá la carpeta `src` de este ZIP y **reemplazá** la existente (sobrescribe los 12 archivos).
3. GitHub Desktop → commit (ej: "dashboard sin interes + reglas mora") → **Push**.
4. Esperá 2-3 min el redeploy de Vercel.
5. **Después del deploy, ejecutá los 2 comandos fetch** (arriba) en la consola del navegador.

✅ TypeScript: 0 errores nuevos en los 12 archivos (2 errores preexistentes en dashboard/route.ts ya están, no los toqué).
