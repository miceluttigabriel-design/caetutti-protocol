# 🎯 FIX ACUMULATIVO: WhatsApp Directo + Historial Fallidos + Sin Interés

## ⭐ NUEVO en esta versión: WhatsApp directo + historial de fallidos

### 1. WhatsApp abre directo (sin pestaña nueva en el navegador)

**Antes**: al apretar "Cliente" se abría una pestaña nueva en el navegador que
luego redirigía a WhatsApp.

**Ahora**: se usa el **deep link nativo `whatsapp://send`** que abre la app de
WhatsApp directamente, sin pasar por el navegador.

```js
const link = document.createElement("a");
link.href = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(mensaje)}`;
document.body.appendChild(link);
link.click();
```

✅ No abre pestaña nueva.
✅ Abre la app de WhatsApp directo con el mensaje ya cargado.
✅ Funciona en desktop y móvil (si WhatsApp está instalado).

---

### 2. Historial de fallidos

**Antes**: si un cliente no tenía teléfono o tenía número inválido, el botón
estaba deshabilitado y no quedaba registro.

**Ahora**: antes de abrir WhatsApp se **valida el número**. Si es inválido o
está vacío:
- Se registra en el historial con `estado: "fallida"` y el `respuesta` (motivo)
- Se muestra un toast: *"No se pudo notificar: Sin teléfono. Quedó registrado en el historial."*
- No se marcan las cuotas como notificadas
- No se cuenta como contacto del día

Motivos que se registran:
- `"Sin teléfono"` — cliente sin número
- `"Número demasiado corto"` — menos de 6 dígitos
- `"Codeudor sin teléfono"` — codeudor sin número
- `"Número de codeudor demasiado corto"`

### 3. Filtro por estado en el Historial

En la pestaña **Historial** ahora hay un selector **"Estado"** con opciones:
- Todos
- **Enviadas**
- **Fallidas** ← para ver dónde falló (número erróneo, sin teléfono, etc.)
- Recibidas
- Leídas

Y se agregó una columna nueva **"Motivo"** que muestra el `respuesta` (motivo del
fallo) cuando el estado es `fallida`.

---

## ✅ Todo lo que incluye este ZIP (acumulativo)

1. **⭐ WhatsApp directo**: deep link `whatsapp://` (sin pestaña nueva)
2. **⭐ Historial de fallidos**: registra fallidas con motivo + filtro por estado
3. **Dashboard sin interés**: "Saldo Por Cobrar" + "% Recuperado del Mes"
4. **Reglas por mora**: 12 reglas (titular + codeudor) por rango de días
5. **Sin interés en Notificaciones**: solo saldo del Excel + días vencidos
6. **Fix timezone**: Vcto y días de atraso correctos (FLEITAS: 01/11, 3d)
7. **Vencidos fuera de POR VENCER**: con cuota vencida → bloque VENCIDOS
8. **Sucursal GLOBAL para Clientes**: sin selector interno
9. **Panel 🤖 Automatización** dentro de Notificaciones
10. **🗑️ Zona Peligrosa** en pestaña General

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

## 📁 Archivos incluidos (13)

| Archivo | Qué cambia |
|---|---|
| `src/components/modules/notificaciones.tsx` | ⭐ Deep link whatsapp:// + validar número + registrar fallida |
| `src/app/api/notificaciones/route.ts` | ⭐ POST acepta `estado` + `respuesta` (motivo fallo) |
| `src/app/api/historial/route.ts` | ⭐ Filtro por `estado` (?estado=fallida) |
| `src/components/modules/historial.tsx` | ⭐ Filtro por estado + columna "Motivo" |
| `src/app/api/dashboard/route.ts` | totalPendiente = saldoGs, sin interés |
| `src/components/modules/dashboard.tsx` | "Saldo Por Cobrar" + "% Recuperado del Mes" |
| `src/app/api/admin/seed-pie-mora/route.ts` | NUEVO: 12 reglas con enfoque mora |
| `src/app/api/admin/reset-mensajes/route.ts` | NUEVO: actualiza templates |
| `src/lib/mensajes.ts` | Saldo sin interés + nuevo pie + fechas UTC |
| `src/lib/format/index.ts` | `fmtDate` usa UTC (fix 31/10 → 01/11) |
| `src/app/api/import/route.ts` | `parseFecha` Excel serial → fecha local |
| `src/components/modules/clientes.tsx` | Vence: usa `fmtDate` + sin selector interno |
| `src/components/dashboard/shell.tsx` | Le pasa la sucursal global a Clientes |
| `src/components/modules/configuracion.tsx` | Sin pestaña Automatización · Zona Peligrosa en General |

## 🔧 Cómo aplicar

1. Abrí la carpeta del repo: `C:\Users\usuario\OneDrive\Documentos\GitHub\viza-home-sistema\caetutti-protocol`
2. Copiá la carpeta `src` de este ZIP y **reemplazá** la existente (sobrescribe los 13 archivos).
3. GitHub Desktop → commit (ej: "whatsapp directo + historial fallidos") → **Push**.
4. Esperá 2-3 min el redeploy de Vercel.
5. **Después del deploy, ejecutá los 2 comandos fetch** (arriba) en la consola del navegador.

## 📝 Cómo ver los fallidos
1. Entrá a la pestaña **Historial**
2. En el filtro **Estado** elegí **Fallidas**
3. Apretá **Buscar**
4. Vas a ver la lista con el motivo en la columna "Motivo"

✅ TypeScript: 0 errores en los 13 archivos.
