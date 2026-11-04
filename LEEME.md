# 🎯 FIX ACUMULATIVO: Vencidos fuera de POR VENCER + Sucursal Global + Pestañas

## ⭐ NUEVO en esta versión: clientes con cuota vencida → VENCIDOS (no mezclados)

### El problema que arreglé
Si un cliente tenía una cuota vencida Y otra por vencer (caso DA SILVA con
vencida 01/11 + por vencer 24/11), el sistema lo mostraba en el bloque
**POR VENCER** — mezclando clientes vencidos con los que realmente están por vencer.

### La solución
**Nuevo criterio de bloque** (con cuidado de no tocar el resto):

| Cliente tiene… | Bloque | "Vcto:" de la tarjeta |
|---|---|---|
| AL MENOS UNA cuota vencida | **VENCIDOS** | su fecha MÁS VENCIDA (la más antigua) |
| Todas por vencer (sin vencidas) | **POR VENCER** | su cuota por vencer más próxima |

Así **ningún cliente vencido aparece mezclado entre los POR VENCER** ✅

### Verificado con los 2 casos reales que mandaste (hoy = 04/11/2026):
```
1. [POR VENCER] Cliente solo con cuota el 15/02/2027  → Vcto: 15/02/2027
2. [POR VENCER] Cliente solo con cuota el 05/11/2026  → Vcto: 05/11/2026
─── (separación entre bloques) ───
3. [VENCIDOS] DA SILVA (vencida 01/11 + por vencer 24/11) → Vcto: 01/11 ✅
4. [VENCIDOS] FLEITAS (vencida 01/11)                     → Vcto: 01/11 ✅
5. [VENCIDOS] Cliente vencido hace 441d                   → Vcto: 20/08/2025
```

DA SILVA ya NO aparece en POR VENCER — ahora está correctamente en VENCIDOS
con su fecha más vencida (01/11).

### Lo que NO se toca (se conserva todo lo aprobado)
- ✅ Orden dentro de POR VENCER: fecha de MAYOR a MENOR (lejano primero)
- ✅ Orden dentro de VENCIDOS: del menos al más vencido
- ✅ Cuotas dentro de cada cliente: por vencer primero, la más vencida al final
- ✅ Panel 🤖 Automatización, sucursal global, Zona Peligrosa, etc.

---

## ✅ También incluye (acumulativo, todo en un ZIP)

### 1. Sucursal GLOBAL para Clientes
- ELIMINADO el selector interno de la pestaña Clientes.
- Filtra con el selector de la barra superior (📍 junto a "Administrador") — el mismo del Dashboard.
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
| `src/app/api/notificaciones/route.ts` | ⭐ Criterio: con cuota vencida → bloque VENCIDOS + campo `fechaMasVencida` |
| `src/components/modules/notificaciones.tsx` | ⭐ "Vcto:" usa `fechaMasVencida` si está en VENCIDOS + panel Automatización |
| `src/components/modules/clientes.tsx` | Sin selector interno · filtra por sucursal global |
| `src/components/dashboard/shell.tsx` | Le pasa la sucursal global a Clientes |
| `src/components/modules/configuracion.tsx` | Sin pestaña Automatización · Zona Peligrosa en General |

## 🔧 Cómo aplicar

1. Abrí la carpeta del repo: `C:\Users\usuario\OneDrive\Documentos\GitHub\viza-home-sistema\caetutti-protocol`
2. Copiá la carpeta `src` de este ZIP y **reemplazá** la existente (sobrescribe los 5 archivos).
3. GitHub Desktop → commit (ej: "vencidos fuera de por vencer") → **Push**.
4. Esperá 2-3 min el redeploy de Vercel.

✅ TypeScript: 0 errores en los 5 archivos.
✅ Lógica probada con los 2 casos reales (DA SILVA y FLEITAS).
