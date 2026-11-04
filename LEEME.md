# 🎯 FIX ACUMULATIVO: Limpiar Clientes Demo + INFORCONF + WhatsApp Directo

## ⭐ NUEVO en esta versión: Limpiar clientes ficticios (CLI0000X)

### El problema
Los clientes demo creados cuando armamos el sistema (CLI00002, CLI00006, CLI00008,
CLI00010, CLI00017, CLI00027, etc.) están mezclados con los clientes reales que
vienen del Excel. Hay que sacarlos.

### La solución: endpoint `/api/admin/limpiar-clientes-demo`

**Criterio seguro** para identificar clientes demo:
1. `codigoEntidad` cumple el patrón `CLI` + dígitos (ej: `CLI00002`, `CLI00027`)
2. **NO tiene ninguna cuota** (pendiente ni cobrada)
3. **NO tiene notificaciones** enviadas

> ⚠️ **SEGURO**: si un cliente CLI0000X tiene cuotas o notificaciones, **NO se borra**
> (queda en la lista "protegidos"). Así nunca perdés datos reales.

### Cómo usarlo

**PASO 1 — PREVIEW (ver qué se borraría, sin borrar nada):**
```js
fetch('/api/admin/limpiar-clientes-demo').then(r => r.json()).then(console.log)
```
Te muestra:
- `aBorrar`: lista de clientes que se eliminarían (con código, nombre, teléfono, sucursal)
- `protegidos`: clientes CLI que NO se borrarán (con motivo)
- `mensaje`: resumen

**PASO 2 — EJECUTAR (borrar definitivamente):**
```js
fetch('/api/admin/limpiar-clientes-demo', {
  method: 'POST',
  headers: {'Content-Type':'application/json'},
  body: '{ "confirmar": true }'
}).then(r => r.json()).then(console.log)
```
Respuesta: `{ mensaje: "Se eliminaron X cliente(s) demo del sistema.", borrados: X, codigosBorrados: [...] }`

### Ejemplo de clientes que se borrarán (los que mencionaste):
- CLI00002 — María Fernanda González
- CLI00006 — Ana Lucía Duarte
- CLI00008 — Patricia Mendieta
- CLI00010 — Cristina Esther Brítez
- CLI00017 — Andrés Felipe Cabrera
- CLI00027 — Walter Fabián Núñez

---

## ✅ Todo lo que incluye este ZIP (acumulativo)

1. **⭐ Limpiar clientes demo**: endpoint seguro con preview + confirmación
2. **INFORCONF**: columna toggle + orden prioritario + aviso en msj + alertas + PDF
3. **Importar Datos** movido a Configuración (pestaña)
4. **Usuarios y Grupos** eliminado del sidebar
5. **WhatsApp directo**: deep link `whatsapp://` (sin pestaña nueva)
6. **Historial de fallidos**: registra fallidas con motivo + filtro por estado
7. **Dashboard sin interés**: "Saldo Por Cobrar" + "% Recuperado del Mes"
8. **Reglas por mora**: 12 reglas (titular + codeudor) por rango de días
9. **Sin interés en Notificaciones**: solo saldo del Excel + días vencidos
10. **Fix timezone**: Vcto y días de atraso correctos (FLEITAS: 01/11, 3d)
11. **Vencidos fuera de POR VENCER**: con cuota vencida → bloque VENCIDOS
12. **Sucursal GLOBAL para Clientes**: sin selector interno
13. **Panel 🤖 Automatización** dentro de Notificaciones
14. **🗑️ Zona Peligrosa** en pestaña General

---

## ⚠️ PASOS IMPORTANTES después del deploy

Ejecutá estos **3 comandos** en la consola del navegador (F12 → "allow pasting"):

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

**3) Limpiar clientes demo (primero preview, después borrar):**
```js
// PREVIEW — ver qué se borraría (no borra nada)
fetch('/api/admin/limpiar-clientes-demo').then(r => r.json()).then(console.log)

// BORRAR — confirmar
fetch('/api/admin/limpiar-clientes-demo', {
  method: 'POST',
  headers: {'Content-Type':'application/json'},
  body: '{ "confirmar": true }'
}).then(r => r.json()).then(console.log)
```

---

## 📁 Archivos incluidos (17)

| Archivo | Qué cambia |
|---|---|
| `src/app/api/admin/limpiar-clientes-demo/route.ts` | ⭐ NUEVO: borra clientes CLI0000X sin historial |
| `src/components/modules/clientes.tsx` | Columna INFORCONF toggle + panel Alertas + botón PDF |
| `src/app/api/inforconf/alertas/route.ts` | NUEVO: lista clientes INFORCONF sin cuota |
| `src/app/api/notificaciones/route.ts` | Ordena INFORMCONF="S" primero |
| `src/app/api/notificaciones/generar-mensaje/route.ts` | Pasa informconf al codeudor |
| `src/lib/mensajes.ts` | Aviso INFORCONF en msj titular + codeudor |
| `src/components/dashboard/sidebar.tsx` | Sin "Importar Datos" ni "Usuarios y Grupos" |
| `src/components/dashboard/shell.tsx` | Sin imports innecesarios |
| `src/components/modules/configuracion.tsx` | Nueva pestaña "Importar Datos" |
| `src/components/modules/notificaciones.tsx` | WhatsApp directo + validar + fallidas |
| `src/app/api/historial/route.ts` | Filtro por `estado` |
| `src/components/modules/historial.tsx` | Filtro estado + columna "Motivo" |
| `src/app/api/dashboard/route.ts` | totalPendiente = saldoGs |
| `src/components/modules/dashboard.tsx` | "Saldo Por Cobrar" + "% Recuperado" |
| `src/app/api/admin/seed-pie-mora/route.ts` | NUEVO: 12 reglas mora |
| `src/app/api/admin/reset-mensajes/route.ts` | NUEVO: actualiza templates |
| `src/lib/format/index.ts` | `fmtDate` UTC (fix timezone) |
| `src/app/api/import/route.ts` | `parseFecha` Excel serial → local |

## 🔧 Cómo aplicar

1. Abrí la carpeta del repo: `C:\Users\usuario\OneDrive\Documentos\GitHub\viza-home-sistema\caetutti-protocol`
2. Copiá la carpeta `src` de este ZIP y **reemplazá** la existente (sobrescribe los 17 archivos).
3. GitHub Desktop → commit (ej: "limpiar clientes demo + inforconf") → **Push**.
4. Esperá 2-3 min el redeploy de Vercel.
5. **Después del deploy, ejecutá los 3 comandos fetch** (arriba) en la consola del navegador.

✅ TypeScript: 0 errores en los 17 archivos.
