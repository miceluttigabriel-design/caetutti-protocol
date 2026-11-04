# 🎯 FIX ACUMULATIVO: WhatsApp abre directo + Vencidos separados + Sucursal Global

## ⭐ NUEVO en esta versión: botón "Cliente" abre WhatsApp directamente

### El problema
Al apretar "Cliente" en Notificaciones para enviar el mensaje, **no abría WhatsApp
directamente**. La causa: el código hacía `await fetch(...)` antes de `window.open()`,
y eso hace que el navegador **bloquee el popup** porque pierde el "gesto del click"
del usuario.

### La solución (truco anti-popup-blocker)
Cambio el orden de operaciones:

1. **Abre una ventana vacía inmediatamente** (sincrónico, dentro del click)
   — esto preserva el gesto del usuario y el navegador NO lo bloquea.
2. Muestra "Abriendo WhatsApp…" en esa ventana.
3. Genera el mensaje (await fetch al backend).
4. **Redirige la ventana ya abierta** a `wa.me/595XXX?text=mensaje`.
5. Marca las cuotas como notificadas en background (sin esperar).

Resultado: al apretar "Cliente" se abre **tu WhatsApp directamente** con el mensaje
ya cargado, listo para que revises y envíes. Si el navegador bloquea los pop-ups,
avisa con un toast claro.

Aplicado a las 2 tarjetas: Titular (botón "Cliente") y Codeudor (botón "Codeudor").

### Lo que NO se toca (se conserva todo lo aprobado)
- ✅ Criterio de bloque: con cuota vencida → VENCIDOS, sin vencidas → POR VENCER
- ✅ Orden dentro de POR VENCER: fecha de mayor a menor (lejano primero)
- ✅ Orden dentro de VENCIDOS: del menos al más vencido
- ✅ "Vcto:" usa fechaMasVencida cuando está en VENCIDOS
- ✅ Cuotas dentro de cada cliente: por vencer primero, la más vencida al final
- ✅ Sucursal global, panel 🤖 Automatización, 🗑️ Zona Peligrosa en General

---

## ✅ También incluye (acumulativo, todo en un ZIP)

1. **WhatsApp directo**: botón Cliente/Codeudor abre wa.me sin bloqueo
2. **Vencidos fuera de POR VENCER**: cliente con cuota vencida → bloque VENCIDOS
3. **Sucursal GLOBAL para Clientes**: sin selector interno, usa el de la barra superior
4. **Panel 🤖 Automatización** dentro de Notificaciones (colapsable)
5. **🗑️ Zona Peligrosa** en pestaña General de Configuraciones
6. **Pestaña Automatización ELIMINADA** de Configuraciones

---

## 📁 Archivos incluidos (5)

| Archivo | Qué cambia |
|---|---|
| `src/components/modules/notificaciones.tsx` | ⭐ WhatsApp directo (titular + codeudor) + panel Automatización + Vcto correcto |
| `src/app/api/notificaciones/route.ts` | Criterio: con cuota vencida → VENCIDOS + campo `fechaMasVencida` |
| `src/components/modules/clientes.tsx` | Sin selector interno · filtra por sucursal global |
| `src/components/dashboard/shell.tsx` | Le pasa la sucursal global a Clientes |
| `src/components/modules/configuracion.tsx` | Sin pestaña Automatización · Zona Peligrosa en General |

## 🔧 Cómo aplicar

1. Abrí la carpeta del repo: `C:\Users\usuario\OneDrive\Documentos\GitHub\viza-home-sistema\caetutti-protocol`
2. Copiá la carpeta `src` de este ZIP y **reemplazá** la existente (sobrescribe los 5 archivos).
3. GitHub Desktop → commit (ej: "whatsapp directo + vencidos separados") → **Push**.
4. Esperá 2-3 min el redeploy de Vercel.

## 📝 Nota sobre pop-ups
Si después del deploy el botón "Cliente" muestra el toast "El navegador bloqueó la
ventana", hacé clic en el ícono del candado en la URL → "Pop-ups y redirecciones" →
Permitir. Solo se pide una vez, después abre siempre.

✅ TypeScript: 0 errores en los 5 archivos.
