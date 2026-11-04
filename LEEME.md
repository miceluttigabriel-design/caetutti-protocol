# 🎯 FIX MÍNIMO: Pie dinámico del Codeudor funciona + reglas de mora

## ⭐ El problema
Cuando borrás el detalle en la plantilla de Codeudor, el pie dinámico no aplica
la regla correcta según los días de atraso (ej: BOGARIN con 1032 días debería
agarrar la regla "181+ días — judicial" pero agarraba otra).

## 🔍 La causa (2 bugs encontrados)

**Bug 1 — Las variables del pie NO se sustituían:**
En `generarMensajeCodeudor`, cuando se obtenía el pie dinámico de la regla, se
usaba directo sin sustituir las variables. Las reglas usan `{dias_absolutos}`,
`{Entidad}`, etc. → quedaban literalmente como "{dias_absolutos}" en el mensaje
final, o peor, la regla no se aplicaba bien porque las variables no estaban.

**Bug 2 — Las reglas `pie_codeudor` no existían en la BD:**
El endpoint que las crea (`seed-pie-mora`) no estaba en el repo. Sin reglas,
`seleccionarPieDinamico` devuelve `null` y cae al `pieEstatico` (que es genérico).

## 🛠️ La solución (2 archivos, sin tocar nada más)

### 1. `src/lib/mensajes.ts` — Sustituir variables del pie
- En `generarMensajeCodeudor`: ahora sustituye las variables del pie con la info
  del codeudor + la cuota con mayor atraso (igual que ya se hacía en el titular)
- En `generarMensajeAgrupado` (titular): también se arregló por simetría

### 2. `src/app/api/admin/seed-pie-mora/route.ts` — NUEVO endpoint
Crea las **12 reglas** (6 titular + 6 codeudor) con el enfoque de que el cliente
consulte el interés por mora con su gestor en línea. Tono gradual:

| Días | Titular | Codeudor |
|------|---------|----------|
| 0-7 | Amable | Amable |
| 8-30 | Cordial | Cordial |
| 31-60 | Firme | Firme |
| 61-90 | Estricto | Estricto |
| 91-180 | Severo | Severo |
| 181+ | Judicial | Judicial |

Todas terminan con "consulte con su gestor en línea" — no mencionan monto de interés.

---

## 🔧 Cómo aplicar (solo 2 archivos)

1. Abrí la carpeta del repo: `C:\Users\usuario\OneDrive\Documentos\GitHub\viza-home-sistema\caetutti-protocol`
2. Copiá la carpeta `src` de este ZIP y **reemplazá** la existente (sobrescribe solo 2 archivos):
   - `src/lib/mensajes.ts`
   - `src/app/api/admin/seed-pie-mora/route.ts` (nuevo)
3. GitHub Desktop → commit (ej: "fix pie codeudor + reglas mora") → **Push**.
4. Esperá 2-3 min el redeploy de Vercel.

## ⚠️ Después del deploy — ejecutá UNA vez en consola (F12)

```js
fetch('/api/admin/seed-pie-mora', {
  method: 'POST',
  headers: {'Content-Type':'application/json'},
  body: '{}'
}).then(r => r.json()).then(console.log)
```

Esto crea las 12 reglas (6 titular + 6 codeudor) en la BD. Verificá la respuesta:
`"Seed completado: 12 reglas creadas (6 cliente + 6 codeudor)."`

## 🧪 Después probá
1. Andá a **Reglas → Plantilla Codeudor** → podés borrar el detalle → Guardar
2. Generá un mensaje para BOGARIN (1032 días) → debe salir el pie **judicial** (181+ días)
3. Generá un mensaje para un cliente con pocos días → debe salir el pie amable

✅ TypeScript: 0 errores en los 2 archivos.
