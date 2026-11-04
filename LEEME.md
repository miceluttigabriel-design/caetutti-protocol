# 🎯 FIX ACUMULATIVO: Orden "Por Vencer" + Sucursal Global + Pestañas

## ⭐ NUEVO en esta versión: Orden "POR VENCER" por FECHA (mayor a menor)

### El cambio pedido
Solo en el rango **POR VENCER**, ahora se ordena por **fecha de MAYOR a MENOR**:
- La fecha más lejana en el futuro aparece **primero** (ej: 15/02/2027)
- La fecha más próxima a vencer aparece al **final de ese bloque** (ej: 05/11/2026)

### Lo que NO se toca (se conserva todo lo aprobado)
- ✅ Cuotas dentro de cada cliente: por vencer primero, la más vencida al final
- ✅ VENCIDOS: del menos vencido al más vencido (igual que ahora)
- ✅ "Vcto:" de la tarjeta: muestra la cuota por vencer más próxima
- ✅ Panel 🤖 Automatización, sucursal global, Zona Peligrosa, etc.

### Verificado con simulación de datos (hoy = 04/11/2026):
```
1. Vence 15/02/2027  ← fecha mayor (más lejana) primero
2. Vence 31/12/2026
3. Vence 26/11/2026
4. Vence 15/11/2026
5. Vence 05/11/2026  ← fecha menor (más próxima) al final del bloque
─── (separación: lo de arriba es POR VENCER, lo de abajo VENCIDOS) ───
6. Vencido hace 1 día
7. Vencido hace 60 días
8. Vencido hace 441 días
```

---

## ✅ También incluye (acumulativo, todo en un ZIP)

### 1. Sucursal GLOBAL para Clientes
- ELIMINADO el selector interno de la pestaña Clientes.
- Filtra con el **selector de la barra superior** (📍 junto a "Administrador") — el mismo del Dashboard.
- Notificaciones ya filtraba por ese selector (titulares + codeudores).

### 2. Panel 🤖 Automatización dentro de Notificaciones
- Arriba de la lista, colapsable, con resumen al instante y los 2 switches:
  Notificaciones automáticas / Detección automática de compromisos.

### 3. 🗑️ Zona Peligrosa → pestaña General de Configuraciones
- Abajo de "Contraseña y Cooldown", con confirmación en 2 pasos.

### 4. Pestaña "Automatización" ELIMINADA de Configuraciones
- Quedan 5 pestañas: General, WhatsApp, Uso y Límites, Plantillas, IA.

---

## 📁 Archivos incluidos (5)

| Archivo | Qué cambia |
|---|---|
| `src/app/api/notificaciones/route.ts` | ⭐ Orden de POR VENCER por fecha mayor→menor |
| `src/components/modules/notificaciones.tsx` | "Vcto" correcto en tarjetas + panel Automatización |
| `src/components/modules/clientes.tsx` | Sin selector interno · filtra por sucursal global |
| `src/components/dashboard/shell.tsx` | Le pasa la sucursal global a Clientes |
| `src/components/modules/configuracion.tsx` | Sin pestaña Automatización · Zona Peligrosa en General |

## 🔧 Cómo aplicar

1. Abrí la carpeta del repo: `C:\Users\usuario\OneDrive\Documentos\GitHub\viza-home-sistema\caetutti-protocol`
2. Copiá la carpeta `src` de este ZIP y **reemplazá** la existente (sobrescribe los 5 archivos).
3. GitHub Desktop → commit (ej: "orden por vencer por fecha") → **Push**.
4. Esperá 2-3 min el redeploy de Vercel.

✅ TypeScript: 0 errores en los 5 archivos.
✅ Lógica de orden probada con simulación (8 casos: por vencer lejano/cercano + vencidos).
