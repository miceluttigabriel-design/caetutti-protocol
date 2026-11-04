# 🎯 FIX ACUMULATIVO: INFORCONF + Alertas PDF + WhatsApp Directo + Sin Interés

## ⭐ NUEVO en esta versión: Sistema INFORCONF completo

### 1. Columna INFORCONF en Clientes (con toggle Sí/No)
- ❌ Eliminada la columna "Cuotas" de la tabla
- ✅ Nueva columna **INFORCONF** con cuadrito clickeable:
  - 🟡 **"Sí"** (fondo ámbar) — el cliente está en INFORCONF
  - ⚪ **"No"** (fondo gris) — no está en INFORCONF
- Al hacer clic cambia el estado al instante (PUT a `/api/clientes/[id]`)
- No hace falta abrir el diálogo de editar para marcarlo

### 2. Clientes con INFORCONF="S" aparecen PRIMERO en Notificaciones
- Dentro de cada bloque (POR VENCER / VENCIDOS), los clientes marcados en
  INFORCONF aparecen **arriba** del todo, antes que los demás.
- Así los ves primero y los notificás prioritariamente.

### 3. Mensaje WhatsApp incluye aviso INFORCONF
- Si el cliente está marcado, el mensaje WhatsApp incluye este aviso
  **automáticamente** entre la cabecera y el detalle:

  > ⚠ AVISO: Su cuenta figura en INFORCONF. Regularice urgentemente para
  > evitar acciones legales.

- También funciona para codeudor (aviso sobre el titular).

### 4. Alertas INFORCONF (clientes sin cuota pendiente)
- Si marcás un cliente como INFORCONF="S" y **no tiene cuota pendiente**
  (no vino en el Excel importado), genera una **alerta** en el sistema.
- Aparece un panel amarillo arriba de la tabla de Clientes:
  > ⚠ Alertas INFORCONF: X cliente(s) — Marcados en INFORCONF sin cuota
  > pendiente activa. Verificar si dejaron de figurar en el Excel.
- Muestra los primeros 10 clientes + un botón **"Exportar PDF / Imprimir"**.

### 5. Reporte PDF imprimible
- Botón **"Exportar PDF / Imprimir"** abre una ventana limpia con:
  - Encabezado: "⚠ ALERTAS INFORCONF" + fecha de emisión
  - Resumen: cantidad de alertas
  - Tabla completa: #, Código, Cliente, CI, Teléfono, Localidad, Sucursal,
    Vendedor, Judicial, Últ. Notif.
  - Pie con fecha y firma
- Se abre automáticamente el diálogo de impresión → podés:
  - **Guardar como PDF** (Chrome: "Destino → Guardar como PDF")
  - **Imprimir directo** en papel
- No requiere instalar librerías externas — usa `window.print()` del navegador.

---

## ✅ Todo lo que incluye este ZIP (acumulativo)

1. **⭐ INFORCONF**: columna toggle + orden prioritario + aviso en msj + alertas + PDF
2. **⭐ Importar Datos** movido a Configuración (pestaña)
3. **⭐ Usuarios y Grupos** eliminado del sidebar
4. **WhatsApp directo**: deep link `whatsapp://` (sin pestaña nueva)
5. **Historial de fallidos**: registra fallidas con motivo + filtro por estado
6. **Dashboard sin interés**: "Saldo Por Cobrar" + "% Recuperado del Mes"
7. **Reglas por mora**: 12 reglas (titular + codeudor) por rango de días
8. **Sin interés en Notificaciones**: solo saldo del Excel + días vencidos
9. **Fix timezone**: Vcto y días de atraso correctos (FLEITAS: 01/11, 3d)
10. **Vencidos fuera de POR VENCER**: con cuota vencida → bloque VENCIDOS
11. **Sucursal GLOBAL para Clientes**: sin selector interno
12. **Panel 🤖 Automatización** dentro de Notificaciones
13. **🗑️ Zona Peligrosa** en pestaña General

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

## 📁 Archivos incluidos (16)

| Archivo | Qué cambia |
|---|---|
| `src/components/modules/clientes.tsx` | ⭐ Columna INFORCONF toggle + panel Alertas + botón PDF |
| `src/app/api/inforconf/alertas/route.ts` | ⭐ NUEVO: lista clientes INFORCONF sin cuota |
| `src/app/api/notificaciones/route.ts` | ⭐ Ordena INFORCONF="S" primero |
| `src/app/api/notificaciones/generar-mensaje/route.ts` | ⭐ Pasa informconf al codeudor |
| `src/lib/mensajes.ts` | ⭐ Aviso INFORCONF en msj titular + codeudor |
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
2. Copiá la carpeta `src` de este ZIP y **reemplazá** la existente (sobrescribe los 16 archivos).
3. GitHub Desktop → commit (ej: "sistema inforconf + alertas pdf") → **Push**.
4. Esperá 2-3 min el redeploy de Vercel.
5. **Después del deploy, ejecutá los 2 comandos fetch** (arriba) en la consola del navegador.

## 📝 Cómo usar el sistema INFORCONF
1. Andá a **Clientes** — ahora la columna "INFORCONF" tiene un cuadrito Sí/No
2. Hacé clic en el cuadrito para marcar/desmarcar al instante
3. Si el cliente está marcado y NO tiene cuota pendiente → aparece la **alerta amarila** arriba
4. Apretá **"Exportar PDF / Imprimir"** → se abre el reporte → elegís "Guardar como PDF" o imprimís
5. En **Notificaciones**, los marcados aparecen primero + el mensaje incluye el aviso ⚠

✅ TypeScript: 0 errores en los 16 archivos.
