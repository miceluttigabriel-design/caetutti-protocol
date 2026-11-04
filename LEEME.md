# 🎯 FIX ACUMULATIVO: Timezone + WhatsApp Directo + Vencidos Separados + Sucursal Global

## ⭐ NUEVO en esta versión: Fix timezone (FLEITAS 31/10 → 01/11)

### El problema
La cuota de FLEITAS FONCESA vencía el **01/11/2026** (según tu sistema financiero),
pero en el Caetutti aparecía como **31/10/2026** — un día menos.

### La causa raíz
Las fechas de vencimiento son "puras" (solo día/mes/año, sin hora real), pero:

1. **Al importar del Excel**: el código convertía el serial Excel con `new Date(ms)`
   que crea la fecha en **UTC** (ej: 2026-11-01T00:00:00.000Z).
2. **Al mostrarla**: `toLocaleDateString("es-PY")` la convertía a **hora local
   Paraguay (UTC-3)** → se volvía 31/10/2026 21:00 → mostraba 31/10.

El mismo bug hacía que el **días de atraso** dé 4 en vez de 3.

### La solución (3 frentes, con cuidado de no romper nada)

1. **`src/app/api/import/route.ts`** — `parseFecha` para Excel serial:
   ahora extrae los componentes UTC y crea con `new Date(y, m, d)` (local).
   Las nuevas importaciones guardarán la fecha correcta.

2. **`src/lib/format/index.ts`** — `fmtDate` ahora usa **componentes UTC**
   directamente (en vez de `toLocaleDateString("es-PY")`):
   ```js
   `${UTCDate}/${UTCMonth+1}/${UTCYear}`
   ```
   Esto arregla TODAS las fechas que ya están en la BD (caso FLEITAS actual)
   sin necesidad de re-importar.

3. **`src/app/api/notificaciones/route.ts`** + **`notificaciones.tsx`**:
   el cálculo de días de atraso ahora usa **UTC en ambos lados** (fecha y hoy).
   Ya no dará 1 día de más.

### Verificado con simulación (TZ America/Asuncion):
```
FLEITAS — cuota real del Excel: 01/11/2026
  ANTES (roto):   31/10/2026 ❌    Días atraso: 4d ❌
  NUEVO (fix):    01/11/2026 ✅    Días atraso: 3d ✅
```

### Lo que NO se toca (se conserva todo lo aprobado)
- ✅ `fmtDateTime` (notificaciones, conversaciones) sigue usando hora local — son fechas reales
- ✅ Vencidos fuera de POR VENCER (DA SILVA, FLEITAS ya no se mezclan)
- ✅ Orden dentro de POR VENCER: fecha de mayor a menor
- ✅ "Vcto:" usa fechaMasVencida en VENCIDOS
- ✅ WhatsApp directo (sin popup-blocker)
- ✅ Sucursal global, panel 🤖 Automatización, 🗑️ Zona Peligrosa en General

---

## ✅ También incluye (acumulativo, todo en un ZIP)

1. **⭐ Fix timezone**: Vcto y días de atraso correctos (FLEITAS: 01/11, 3d)
2. **WhatsApp directo**: botón Cliente/Codeudor abre wa.me sin bloqueo
3. **Vencidos fuera de POR VENCER**: con cuota vencida → bloque VENCIDOS
4. **Sucursal GLOBAL para Clientes**: sin selector interno
5. **Panel 🤖 Automatización** dentro de Notificaciones
6. **🗑️ Zona Peligrosa** en pestaña General
7. **Pestaña Automatización ELIMINADA** de Configuraciones

---

## 📁 Archivos incluidos (7)

| Archivo | Qué cambia |
|---|---|
| `src/lib/format/index.ts` | ⭐ `fmtDate` usa UTC components (fix fechas 31/10 → 01/11) |
| `src/app/api/import/route.ts` | ⭐ `parseFecha` Excel serial → fecha local (no UTC) |
| `src/app/api/notificaciones/route.ts` | ⭐ Cálculo días atraso con UTC + criterio vencidos + campo `fechaMasVencida` |
| `src/components/modules/notificaciones.tsx` | WhatsApp directo + Vcto correcto + panel Automatización + días UTC |
| `src/components/modules/clientes.tsx` | Vence: usa `fmtDate` (fix timezone) + sin selector interno |
| `src/components/dashboard/shell.tsx` | Le pasa la sucursal global a Clientes |
| `src/components/modules/configuracion.tsx` | Sin pestaña Automatización · Zona Peligrosa en General |

## 🔧 Cómo aplicar

1. Abrí la carpeta del repo: `C:\Users\usuario\OneDrive\Documentos\GitHub\viza-home-sistema\caetutti-protocol`
2. Copiá la carpeta `src` de este ZIP y **reemplazá** la existente (sobrescribe los 7 archivos).
3. GitHub Desktop → commit (ej: "fix timezone fechas vcto") → **Push**.
4. Esperá 2-3 min el redeploy de Vercel.

## 📝 Notas importantes
- **No hace falta re-importar el Excel**: el fix en `fmtDate` ya arregla TODAS las
  fechas que están en la BD mostrándolas con componentes UTC.
- **Las próximas importaciones** también serán correctas (fix en `parseFecha`).
- **Días de atraso** recalculados al vuelo en cada carga de Notificaciones.

✅ TypeScript: 0 errores en los 7 archivos.
✅ Lógica probada con simulación (caso FLEITAS: 01/11/2026 + 3 días de atraso).
