# ⚡ FIX VELOCIDAD — Carga de Clientes (y bonus: eliminar usuarios demo)

## ¿Por qué estaba lento?

El endpoint `/api/clientes` hacía **~8.500 consultas a la base de datos en cada carga**
(3 consultas por cada cliente: saldo, última notificación, estado notificado × 2.824 clientes).
Con Neon en EE.UU. eso tardaba 30–120 segundos o expiraba → la página quedaba en 0.

Además, cada vez que cambiabas de pestaña y volvías, TODO se recargaba de nuevo.

## ¿Qué cambia este patch?

| Archivo | Cambio |
|---|---|
| `src/app/api/clientes/route.ts` | **De ~8.500 consultas → 4 consultas totales** (groupBy + cruce en memoria). Misma respuesta, mismo formato. |
| `src/components/modules/clientes.tsx` | **Paginación: 50 clientes por página** (con buscador, stats sobre el total) + **cache de 5 minutos** (cambiar de pestaña ya no recarga) + indicador "actualizando…". |
| `src/lib/db.ts` | En producción ya no loguea cada query SQL (ahorraba CPU/memoria con miles de consultas). |
| `src/app/api/admin/optimizar-db/route.ts` | **NUEVO** — crea índices en la BD para acelerar Clientes, Notificaciones y Dashboard. |

**Tiempo esperado de carga después del fix: 2–4 segundos** (antes 30s+ o timeout).

---

## PASO 1 — Instalar el patch

1. Descomprimí `fix-velocidad-clientes.zip`
2. Copiá las carpetas `src/` dentro de la raíz del repo
   `C:\Users\usuario\OneDrive\Documentos\GitHub\viza-home-sistema\caetutti-protocol`
   (se reemplazan 3 archivos y se agrega 1 nuevo)
3. En GitHub Desktop → commit (ej: "⚡ Optimizar velocidad Clientes") → **Push origin**
4. Esperá 2–3 minutos al redeploy de Vercel

## PASO 2 — Probar

Entrá a **Clientes** en https://caetutti-protocol.vercel.app.
Debería cargar en pocos segundos y mostrar el paginador abajo:
`Mostrando 1–50 de 2824 clientes · Página 1 de 57`

## PASO 3 (una sola vez) — Crear índices en la BD

Con la sesión abierta, presioná **F12** → pestaña **Console** → escribí `allow pasting` (Enter) → pegá este comando y Enter:

```js
fetch('/api/admin/optimizar-db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ejecutar:true})}).then(r=>r.json()).then(console.log)
```

Si querés ver el diagnóstico antes (solo lectura):

```js
fetch('/api/admin/optimizar-db').then(r=>r.json()).then(console.log)
```

## PASO 4 (bonus pendiente) — Eliminar usuarios cobrador y vendedor

Este endpoint **ya estaba desplegado** en el sistema; solo faltaba ejecutarlo.
Con F12 → Console → `allow pasting` → pegá:

```js
fetch('/api/admin/limpiar-usuarios-demo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmar:true})}).then(r=>r.json()).then(console.log)
```

Esto borra de la base de datos los usuarios **cobrador** y **vendedor** y devuelve la lista de usuarios restantes (debería quedar solo **admin**). La pantalla de login ya muestra únicamente el acceso rápido de Admin, así que no necesita cambios.

---

## Notas técnicas

- Los índices son seguros: no tocan datos, solo crean estructuras de búsqueda.
- Si más adelante corré `prisma db push`, Prisma puede querer recrear estos índices con otros nombres — no pasa nada, son equivalentes.
- El buscador y las tarjetas de estadísticas siguen funcionando sobre **todo** el listado (las 2.824 filas), solo la tabla dibuja 50 por página.
- Al guardar/editar/importar clientes, el cache se invalida solo y refresca automáticamente.
