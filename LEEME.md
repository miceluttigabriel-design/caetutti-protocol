# 🎯 FIX ACUMULATIVO: Orden de Vencimientos + Sucursal Global + Pestañas

## ⭐ NUEVO en esta versión: Orden de fechas "Vcto" en Notificaciones

### El problema
La lista de Notificaciones mezclaba los clientes: los "por vencer" aparecían en
orden **alfabético** (sin importar la fecha) y un cliente con una cuota muy vieja
se iba al fondo aunque tuviera cuota por vencer.

### La solución (como lo pediste: de los que están para vencer HASTA los más vencidos)
**Lista de clientes:**
1. **Primero los que tienen cuotas POR VENCER**, ordenados por su próximo vencimiento:
   el que vence mañana → luego +2 días → +3 días… (día y mes reales, cronológico).
2. **Después los ya vencidos**: del menos vencido al más vencido (el más antiguo queda AL FINAL).

**El "Vcto:" de cada tarjeta** ahora muestra la cuota **por vencer más próxima**;
si el cliente ya tiene todo vencido, muestra la vencida más reciente.

**Las cuotas dentro de cada cliente** (detalle y mensaje WhatsApp) quedan igual:
por vencer primero, la más vencida al final.

*Ejemplo verificado con datos reales de prueba (hoy = 04/11/2026):*
```
1. Cliente con vcto 10/11/2026   (por vencer, el más próximo)
2. Cliente con vcto 15/11/2026
3. Cliente con vcto 26/11/2026
4. Cliente con vcto 31/12/2026
5. Cliente vencido hace 1 día
6. Cliente vencido hace 441 días (el más vencido, al final)
```

---

## ✅ También incluye (de la versión anterior, si no la aplicaste)

### 1. Sucursal GLOBAL para Clientes
- ELIMINADO el selector de sucursal interno de la pestaña Clientes.
- Clientes ahora se filtra con el **selector de la barra superior** (📍 junto a
  "Administrador") — el mismo del Dashboard.
- **Notificaciones ya filtraba** por ese selector (titulares + codeudores) — verificado.

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
| `src/app/api/notificaciones/route.ts` | ⭐ Orden cronológico real de la lista y las cuotas |
| `src/components/modules/notificaciones.tsx` | ⭐ "Vcto" correcto en tarjetas + panel Automatización |
| `src/components/modules/clientes.tsx` | Sin selector interno · filtra por sucursal global |
| `src/components/dashboard/shell.tsx` | Le pasa la sucursal global a Clientes |
| `src/components/modules/configuracion.tsx` | Sin pestaña Automatización · Zona Peligrosa en General |

## 🔧 Cómo aplicar

1. Abrí la carpeta del repo: `C:\Users\usuario\OneDrive\Documentos\GitHub\viza-home-sistema\caetutti-protocol`
2. Copiá la carpeta `src` de este ZIP y **reemplazá** la existente (sobrescribe los 5 archivos).
3. GitHub Desktop → commit (ej: "orden vcto + sucursal global") → **Push**.
4. Esperá 2-3 min el redeploy de Vercel y probá en Notificaciones.

✅ Verificado con TypeScript: 0 errores en los 5 archivos.
✅ Lógica de orden probada con simulación de datos (6 casos: por vencer cercano/lejano, mixto, vencido ayer, muy vencido).
