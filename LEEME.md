# 🎯 FIX ACUMULATIVO: Editar/Borrar Detalle Plantillas + Fix Codeudor + INFORCONF

## ⭐ NUEVO en esta versión: Poder borrar el detalle de las plantillas

### El bug que viste
Cuando querías borrar el contenido del campo "Detalle" en **Reglas → Plantilla Codeudor**
(para mandar un mensaje simple sin "Vence: ... · Saldo: ... · días"), te salía
**"Error al guardar"** y no te dejaba guardar.

### La causa
En `/api/templates/codeudor/route.ts` (y `agrupada/route.ts`) estaba:
```js
if (!cabecera || !detalle) {
  return fail("cabecera y detalle son requeridos");
}
```
Si borrabas el detalle → `detalle = ""` → `!detalle` era `true` → rechazaba con error.

### La solución
- ✅ Ahora **permitimos que `detalle` y `pieEstatico` sean strings vacíos** (`""`)
- ✅ Solo la **cabecera** sigue siendo obligatoria (es el saludo mínimo del mensaje)
- ✅ Si el detalle está vacío, el mensaje se genera sin esa sección (sin líneas en blanco)

### Ejemplo de uso
Si querés mandar solo:
> Estimado/a codeudor, le informamos que el cliente BOGARIN MARTINEZ, ALEXIS tiene una deuda activa.
> Verifique el valor de su interés mora con su gestor en línea.

Ahora podés:
- **Cabecera**: "Estimado/a codeudor, le informamos que el cliente {Entidad} tiene una deuda activa."
- **Detalle**: (dejar vacío)
- **Pie dinámico**: activado (usará las reglas de mora según días)

Y se guarda sin problema. ✅

Aplicado a las 2 plantillas (titular y codeudor).

---

## ✅ Todo lo que incluye este ZIP (acumulativo)

1. **⭐ Editar/borrar detalle plantillas** (titular + codeudor) sin error
2. **Fix bug codeudor**: {Entidad} = nombre del titular, no "Codeudor"
3. **Limpiar clientes demo**: endpoint seguro con preview + confirmación
4. **INFORCONF**: columna toggle + orden prioritario + aviso en msj + alertas + PDF
5. **Importar Datos** movido a Configuración (pestaña)
6. **Usuarios y Grupos** eliminado del sidebar
7. **WhatsApp directo**: deep link `whatsapp://` (sin pestaña nueva)
8. **Historial de fallidos**: registra fallidas con motivo + filtro por estado
9. **Dashboard sin interés**: "Saldo Por Cobrar" + "% Recuperado del Mes"
10. **Reglas por mora**: 12 reglas (titular + codeudor) por rango de días
11. **Sin interés en Notificaciones**: solo saldo del Excel + días vencidos
12. **Fix timezone**: Vcto y días de atraso correctos (FLEITAS: 01/11, 3d)
13. **Vencidos fuera de POR VENCER**: con cuota vencida → bloque VENCIDOS
14. **Sucursal GLOBAL para Clientes**: sin selector interno
15. **Panel 🤖 Automatización** dentro de Notificaciones
16. **🗑️ Zona Peligrosa** en pestaña General

---

## ⚠️ PASOS IMPORTANTES después del deploy

Ejecutá estos comandos en la consola del navegador (F12 → "allow pasting"):

**1) Actualizar templates con el nuevo pie (titular + codeudor):**
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

**3) Limpiar clientes demo (opcional, primero preview):**
```js
fetch('/api/admin/limpiar-clientes-demo').then(r => r.json()).then(console.log)
// después confirmar:
fetch('/api/admin/limpiar-clientes-demo', {
  method: 'POST',
  headers: {'Content-Type':'application/json'},
  body: '{ "confirmar": true }'
}).then(r => r.json()).then(console.log)
```

---

## 📁 Archivos incluidos

| Archivo | Qué cambia |
|---|---|
| `src/app/api/templates/codeudor/route.ts` | ⭐ FIX: permite detalle/pieEstatico vacíos |
| `src/app/api/templates/agrupada/route.ts` | ⭐ FIX: permite detalle/pieEstatico vacíos |
| `src/lib/mensajes.ts` | ⭐ Solo agrega detalle si no está vacío + aviso INFORCONF + UTC + var {Nombre Codeudor} |
| `src/app/api/notificaciones/generar-mensaje/route.ts` | Fix: {Entidad} = nombre titular, no "Codeudor" |
| `src/app/api/admin/limpiar-clientes-demo/route.ts` | NUEVO: borra clientes CLI0000X sin historial |
| `src/components/modules/clientes.tsx` | Columna INFORCONF toggle + panel Alertas + botón PDF |
| `src/app/api/inforconf/alertas/route.ts` | NUEVO: lista clientes INFORCONF sin cuota |
| `src/app/api/notificaciones/route.ts` | Ordena INFORCONF="S" primero + criterio vencidos + días UTC |
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
2. Copiá la carpeta `src` de este ZIP y **reemplazá** la existente.
3. GitHub Desktop → commit (ej: "fix editar detalle plantillas") → **Push**.
4. Esperá 2-3 min el redeploy de Vercel.
5. **Después del deploy, ejecutá los comandos fetch** (arriba) en la consola del navegador.

## 📝 Cómo editar/borrar el detalle
1. Andá a **Reglas → Plantilla Codeudor** (o Plantilla Agrupada)
2. Borra el contenido del campo **"Detalle"** (o dejalo con el texto que quieras)
3. Apretá **"Guardar template"** → ahora se guarda sin error ✅
4. Si dejaste el detalle vacío, el mensaje se arma solo con cabecera + pie (sin líneas en blanco)

✅ TypeScript: 0 errores en los archivos modificados.
