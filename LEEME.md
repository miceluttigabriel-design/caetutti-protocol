# 🎯 FIX ÚNICO: Sucursal Global + Pestañas + Zona Peligrosa

## Qué hace este patch (todo en uno)

### 1️⃣ Sucursal GLOBAL para Clientes (lo nuevo)
- **ELIMINADO** el selector de sucursal que estaba dentro de la pestaña Clientes
  (el que estaba al lado del buscador). Ya no existe.
- Ahora la pestaña **Clientes se filtra con el selector de la barra superior**
  (el de al lado de "Administrador", con el 📍 MapPin) — **el mismo que usa el Dashboard**.
- Al elegir una sucursal arriba → Clientes muestra SOLO los clientes de esa sucursal
  (stats, lista y paginación incluidos). "Todas las sucursales" = ves todo.
- La sucursal elegida se recuerda aunque cierres sesión (ya lo hacía el sistema).

### 2️⃣ Notificaciones por sucursal (verificado)
- La pestaña Notificaciones **YA usaba** el selector global de arriba: los clientes
  a notificar (titulares y codeudores) se filtran por la sucursal elegida arriba.
- No necesitaba cambios: confirmado en el código (`/api/notificaciones?sucursal=...`).

### 3️⃣ Notificaciones automáticas → van DENTRO de Notificaciones
- Se quitó la pestaña "Automatización" de Configuraciones.
- Ahora en la parte de **arriba de Notificaciones** hay un panel colapsable
  "🤖 Automatización" con:
  - Resumen al instante: `Notif. auto ON · Detección compromisos ON` o "Sin automatizaciones activas"
  - Botón "Configurar" → muestra los 2 switches:
    - Notificaciones automáticas
    - Detección automática de compromisos
  - Guardado directo.

### 4️⃣ Zona Peligrosa → ahora está en General (Configuraciones)
- La tarjeta roja "🗑️ Zona Peligrosa — Borrar TODAS las deudas" quedó dentro de la
  pestaña **General** de Configuraciones, abajo de "Contraseña y Cooldown".
- Sigue pidiendo confirmación en 2 pasos. Los clientes SIEMPRE se preservan.

### 5️⃣ Pestaña "Automatización" ELIMINADA de Configuraciones
- Configuraciones queda con 5 pestañas: General, WhatsApp, Uso y Límites, Plantillas, IA.

---

## 📁 Archivos incluidos (4)

| Archivo | Qué cambia |
|---|---|
| `src/components/modules/clientes.tsx` | Sin selector interno · filtra por sucursal global |
| `src/components/dashboard/shell.tsx` | Le pasa la sucursal global a Clientes |
| `src/components/modules/notificaciones.tsx` | Panel de Automatización arriba |
| `src/components/modules/configuracion.tsx` | Sin pestaña Automatización · Zona Peligrosa en General |

## 🔧 Cómo aplicar

1. Abrí la carpeta del repo: `C:\Users\usuario\OneDrive\Documentos\GitHub\viza-home-sistema\caetutti-protocol`
2. Copiá la carpeta `src` de este ZIP y **reemplazá** la existente
   (sobrescriben 4 archivos, no borra nada más).
3. GitHub Desktop → commit (ej: "sucursal global + pestanas fix") → **Push**.
4. Esperá 2-3 min el redeploy de Vercel.

✅ Verificado con TypeScript: 0 errores en los 4 archivos modificados.
(los ~21 errores que salen en la consola ya existían antes y Vercel los ignora)
