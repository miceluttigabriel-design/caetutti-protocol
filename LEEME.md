# 🎯 FIX ACUMULATIVO: Bug Codeudor + INFORCONF + Limpiar Demo + WhatsApp Directo

## ⭐ NUEVO en esta versión: Fix bug "el cliente Codeudor tiene deuda"

### El bug que viste
Cuando generabas el mensaje para un codeudor, salía:
> "Estimado/a codeudor, le informamos que el cliente **Codeudor** tiene una deuda activa."

En vez del nombre real del titular (ej: BOGARIN MARTINEZ, ALEXIS).

### La causa
En `generar-mensaje/route.ts` línea 55 estaba:
```js
entidad: clienteData.codeudorNombre || "Codeudor"
```
Pero el frontend manda `cliente.codeudor = { nombre, telefono, ... }` (objeto), NO `cliente.codeudorNombre`. Entonces siempre caía al fallback `"Codeudor"`.

Además, el template del codeudor dice `"el cliente {Entidad} tiene..."` → `{Entidad}` debería ser el nombre del **TITULAR** (el que debe), no el del codeudor.

### La solución
- `codeudorData.entidad` ahora = nombre del **TITULAR** (`clienteData.entidad`)
- `codeudorData.nombreCodeudor` = nombre del codeudor (para variable `{Nombre Codeudor}`)
- `codeudorData.informconf` = el INFORCONF del titular (para el aviso ⚠)
- El fallback del titular ahora es `"el titular"` (más natural que "Codeudor")

### Resultado
Ahora el mensaje del codeudor sale:
> Estimado/a codeudor, le informamos que el cliente **BOGARIN MARTINEZ, ALEXIS** tiene cuotas pendientes por un total de ₲ 540.000.
>
> - Vence: 07/01/2024 · Saldo: ₲ 540.000 · Vencido hace 1032 días
>
> [pie según regla de mora]

---

## ✅ Todo lo que incluye este ZIP (acumulativo)

1. **⭐ Fix bug codeudor**: {Entidad} = nombre del titular, no "Codeudor"
2. **Limpiar clientes demo**: endpoint seguro con preview + confirmación
3. **INFORCONF**: columna toggle + orden prioritario + aviso en msj + alertas + PDF
4. **Importar Datos** movido a Configuración (pestaña)
5. **Usuarios y Grupos** eliminado del sidebar
6. **WhatsApp directo**: deep link `whatsapp://` (sin pestaña nueva)
7. **Historial de fallidos**: registra fallidas con motivo + filtro por estado
8. **Dashboard sin interés**: "Saldo Por Cobrar" + "% Recuperado del Mes"
9. **Reglas por mora**: 12 reglas (titular + codeudor) por rango de días
10. **Sin interés en Notificaciones**: solo saldo del Excel + días vencidos
11. **Fix timezone**: Vcto y días de atraso correctos (FLEITAS: 01/11, 3d)
12. **Vencidos fuera de POR VENCER**: con cuota vencida → bloque VENCIDOS
13. **Sucursal GLOBAL para Clientes**: sin selector interno
14. **Panel 🤖 Automatización** dentro de Notificaciones
15. **🗑️ Zona Peligrosa** en pestaña General

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
// PREVIEW
fetch('/api/admin/limpiar-clientes-demo').then(r => r.json()).then(console.log)

// BORRAR
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
| `src/app/api/notificaciones/generar-mensaje/route.ts` | ⭐ Fix: {Entidad} = nombre titular, no "Codeudor" |
| `src/lib/mensajes.ts` | ⭐ Aviso INFORCONF en titular + codeudor + UTC + var {Nombre Codeudor} |
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
3. GitHub Desktop → commit (ej: "fix codeudor nombre titular") → **Push**.
4. Esperá 2-3 min el redeploy de Vercel.
5. **Después del deploy, ejecutá los comandos fetch** (arriba) en la consola del navegador.

✅ TypeScript: 0 errores en los archivos modificados.
