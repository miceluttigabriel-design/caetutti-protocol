# 🎯 FIX ACUMULATIVO: Sin Interés + Mensaje Nuevo + Timezone + WhatsApp Directo

## ⭐ NUEVO en esta versión: NO trabajamos con interés

### El problema
El interés que calculaba el sistema **no cuadraba** con el del Excel. El Excel
solo trae el saldo, así que calcular interés nuestro era incorrecto.

### La solución (3 frentes)

**1) API de Notificaciones (`route.ts`)**:
- `saldoTotalGs = saldoGs` (sin interés sumado)
- `interesGs = 0`
- `totalInteres = 0`
- Solo se cuentan los días vencidos (eso sí cuadra)

**2) UI de Notificaciones (`notificaciones.tsx`)**:
- ❌ Eliminado "+₲X interés" de la tarjeta
- ❌ Eliminado "Interés acum." y "Saldo s/ interés" del detalle
- ❌ Eliminado "+₲X interés" del listado de cuotas
- ✅ Solo se muestra el saldo (el del Excel) y los días vencidos

**3) Generador de mensaje WhatsApp (`mensajes.ts`)**:
- La variable `{Saldo en Gs}` ahora usa `saldoGs` directo (no `saldoTotalGs`)
- Las fechas en el mensaje usan UTC (fix timezone)
- **Nuevo pie por defecto** (el formato que pediste):
  > *"Verifique el valor de su interés mora para poder abonar su cuenta.
  >  Consulte ahora mismo con su gestor en línea."*

### Ejemplo de mensaje nuevo:
```
Estimado/a FLEITAS FONCESA, ADILSON, le informamos que tiene
cuotas pendientes por un total de ₲ 241.208.

- Vence: 01/11/2026 · Saldo: ₲ 241.208 · Vencido hace 3 días

Verifique el valor de su interés mora para poder abonar su cuenta.
Consulte ahora mismo con su gestor en línea.
```

---

## ⚠️ PASO IMPORTANTE: actualizar los templates existentes

Los templates que ya están en tu BD **NO se actualizan solos** con el deploy.
Después del deploy tenés que ejecutar este comando UNA vez en la consola
del navegador (F12 → escribir `allow pasting` → pegar):

```js
fetch('/api/admin/reset-mensajes', { method: 'POST' })
  .then(r => r.json())
  .then(console.log)
```

Esto actualiza los 2 templates (agrupado + codeudor) con el nuevo pie. Si después
querés personalizar el texto, lo hacés desde **Configuración → Plantillas**.

---

## ✅ También incluye (acumulativo, todo en un ZIP)

1. **⭐ Sin interés**: solo saldo del Excel + días vencidos
2. **⭐ Mensaje nuevo**: "verifique interés mora con su gestor en línea"
3. **Fix timezone**: Vcto y días de atraso correctos (FLEITAS: 01/11, 3d)
4. **WhatsApp directo**: botón Cliente/Codeudor abre wa.me sin bloqueo
5. **Vencidos fuera de POR VENCER**: con cuota vencida → bloque VENCIDOS
6. **Sucursal GLOBAL para Clientes**: sin selector interno
7. **Panel 🤖 Automatización** dentro de Notificaciones
8. **🗑️ Zona Peligrosa** en pestaña General
9. **Pestaña Automatización ELIMINADA** de Configuraciones

---

## 📁 Archivos incluidos (8)

| Archivo | Qué cambia |
|---|---|
| `src/lib/mensajes.ts` | ⭐ Saldo sin interés + nuevo pie + fechas UTC |
| `src/app/api/notificaciones/route.ts` | ⭐ saldoTotalGs=saldoGs, interesGs=0 + criterio vencidos + días UTC |
| `src/components/modules/notificaciones.tsx` | ⭐ Sin "+interés" en UI + WhatsApp directo + Vcto correcto + días UTC |
| `src/app/api/admin/reset-mensajes/route.ts` | ⭐ NUEVO: actualiza templates existentes con el nuevo pie |
| `src/lib/format/index.ts` | `fmtDate` usa UTC (fix 31/10 → 01/11) |
| `src/app/api/import/route.ts` | `parseFecha` Excel serial → fecha local |
| `src/components/modules/clientes.tsx` | Vence: usa `fmtDate` + sin selector interno |
| `src/components/dashboard/shell.tsx` | Le pasa la sucursal global a Clientes |
| `src/components/modules/configuracion.tsx` | Sin pestaña Automatización · Zona Peligrosa en General |

## 🔧 Cómo aplicar

1. Abrí la carpeta del repo: `C:\Users\usuario\OneDrive\Documentos\GitHub\viza-home-sistema\caetutti-protocol`
2. Copiá la carpeta `src` de este ZIP y **reemplazá** la existente (sobrescribe los 9 archivos).
3. GitHub Desktop → commit (ej: "sin interes + mensaje nuevo + timezone fix") → **Push**.
4. Esperá 2-3 min el redeploy de Vercel.
5. **Después del deploy, ejecutá UNA vez en la consola del navegador (F12)**:
   ```js
   fetch('/api/admin/reset-mensajes', { method: 'POST' }).then(r => r.json()).then(console.log)
   ```
   Esto actualiza los templates con el nuevo pie.

✅ TypeScript: 0 errores en los 9 archivos.
