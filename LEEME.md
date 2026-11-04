# 🎯 FIX ACUMULATIVO: Importar en Configuración + Sin Usuarios + WhatsApp Directo

## ⭐ NUEVO en esta versión: Mover Importar + Eliminar Usuarios

### 1. "Importar Datos" ahora vive DENTRO de Configuración
- ❌ Eliminado del menú lateral (sidebar)
- ✅ Ahora es una pestaña más dentro de **Configuración**:
  General · WhatsApp · Uso y Límites · Plantillas · IA · **Importar Datos** (con ícono 📤)

### 2. "Usuarios y Grupos" eliminado del menú lateral
- ❌ Ya no aparece en el sidebar (como solo vos lo usás, no hace falta)
- Si por URL vieja alguien entra a `/admin-usuarios`, redirige al Dashboard
- Los archivos del módulo no se borraron (por las dudas), solo se quita del menú

### Menú lateral final (más limpio):
```
Principal:
  • Dashboard

Notificaciones:
  • Notificaciones
  • Comunicaciones
  • Promesas de Pago
  • Contactos del Día
  • Historial

Negocio:
  • Clientes
  • Deudas
  • Mantenimiento

Configuración:
  • Reglas
  • Configuración  ← acá adentro está "Importar Datos" como pestaña
```

---

## ✅ Todo lo que incluye este ZIP (acumulativo)

1. **⭐ Importar Datos** movido a Configuración (pestaña nueva)
2. **⭐ Usuarios y Grupos** eliminado del sidebar
3. **WhatsApp directo**: deep link `whatsapp://` (sin pestaña nueva)
4. **Historial de fallidos**: registra fallidas con motivo + filtro por estado
5. **Dashboard sin interés**: "Saldo Por Cobrar" + "% Recuperado del Mes"
6. **Reglas por mora**: 12 reglas (titular + codeudor) por rango de días
7. **Sin interés en Notificaciones**: solo saldo del Excel + días vencidos
8. **Fix timezone**: Vcto y días de atraso correctos (FLEITAS: 01/11, 3d)
9. **Vencidos fuera de POR VENCER**: con cuota vencida → bloque VENCIDOS
10. **Sucursal GLOBAL para Clientes**: sin selector interno
11. **Panel 🤖 Automatización** dentro de Notificaciones
12. **🗑️ Zona Peligrosa** en pestaña General

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
| `src/components/dashboard/sidebar.tsx` | ⭐ Sin "Importar Datos" ni "Usuarios y Grupos" |
| `src/components/dashboard/shell.tsx` | ⭐ Sin imports de ImportarModule/AdminUsuarios + redirección segura |
| `src/components/modules/configuracion.tsx` | ⭐ Nueva pestaña "Importar Datos" con ImportarModule |
| `src/components/modules/notificaciones.tsx` | Deep link whatsapp:// + validar número + registrar fallida |
| `src/app/api/notificaciones/route.ts` | POST acepta `estado` + `respuesta` (motivo fallo) |
| `src/app/api/historial/route.ts` | Filtro por `estado` (?estado=fallida) |
| `src/components/modules/historial.tsx` | Filtro por estado + columna "Motivo" |
| `src/app/api/dashboard/route.ts` | totalPendiente = saldoGs, sin interés |
| `src/components/modules/dashboard.tsx` | "Saldo Por Cobrar" + "% Recuperado del Mes" |
| `src/app/api/admin/seed-pie-mora/route.ts` | NUEVO: 12 reglas con enfoque mora |
| `src/app/api/admin/reset-mensajes/route.ts` | NUEVO: actualiza templates |
| `src/lib/mensajes.ts` | Saldo sin interés + nuevo pie + fechas UTC |
| `src/lib/format/index.ts` | `fmtDate` usa UTC (fix 31/10 → 01/11) |
| `src/app/api/import/route.ts` | `parseFecha` Excel serial → fecha local |
| `src/components/modules/clientes.tsx` | Vence: usa `fmtDate` + sin selector interno |

## 🔧 Cómo aplicar

1. Abrí la carpeta del repo: `C:\Users\usuario\OneDrive\Documentos\GitHub\viza-home-sistema\caetutti-protocol`
2. Copiá la carpeta `src` de este ZIP y **reemplazá** la existente (sobrescribe los 13 archivos).
3. GitHub Desktop → commit (ej: "importar a config + sin usuarios") → **Push**.
4. Esperá 2-3 min el redeploy de Vercel.
5. **Después del deploy, ejecutá los 2 comandos fetch** (arriba) en la consola del navegador.

## 📝 Cómo usar Importar Datos ahora
1. Andá a **Configuración** en el menú lateral
2. Apretá la pestaña **📤 Importar Datos** (la última)
3. Vas a ver el mismo formulario de siempre para subir Excel/JSON

✅ TypeScript: 0 errores en los 13 archivos.
