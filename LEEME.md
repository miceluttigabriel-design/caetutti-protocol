# 🎯 FIX MÍNIMO: Pie inteligente del Codeudor (funciona sin seed-pie-mora)

## ⭐ El problema que seguías viendo
BOGARIN con 1032 días de atraso recibía un pie **amable** ("le agradecemos gestionar el pago") en vez del pie **judicial** que corresponde.

## 🔍 La causa real (NO era solo "falta ejecutar seed-pie-mora")
Había 2 bugs combinados:

**Bug 1 — Las variables del pie no se sustituían:**
El pie de la regla se usaba literal sin reemplazar `{dias_absolutos}`, `{Entidad}`, etc.

**Bug 2 — Sin reglas en BD → caía al pieEstatico genérico:**
Si `seed-pie-mora` no se ejecutaba (o no estaba deployado), `seleccionarPieDinamico` devolvía `null` y el sistema caía al `pieEstatico` del template — que siempre es **el mismo texto amable sin importar los días**.

## 🛠️ La solución (3 archivos, sin tocar nada más)

### 1. `src/lib/mensajes.ts`
- **Sustituye variables del pie** en titular y codeudor (ya estaba, pero Confirmado que funciona)
- **NUEVO: Pies inteligentes de fallback** — si no hay reglas en BD, ahora se genera un pie con **tono adecuado a los días de atraso** (amable/cordial/firme/estricto/severo/judicial) en vez del pieEstatico genérico

### 2. `src/app/api/admin/seed-pie-mora/route.ts` (NUEVO endpoint)
Crea las 12 reglas (6 titular + 6 codeudor) en la BD, con tono gradual y enfoque "consulte interés mora con su gestor en línea".

### 3. `src/app/api/admin/reset-mensajes/route.ts` (NUEVO endpoint)
Actualiza los `pieEstatico` de los templates existentes con el nuevo texto (los que ya están en BD no se auto-actualizan).

---

## 🔧 Cómo aplicar (3 archivos)

1. Abrí la carpeta del repo: `C:\Users\usuario\OneDrive\Documentos\GitHub\viza-home-sistema\caetutti-protocol`
2. Copiá la carpeta `src` de este ZIP y **reemplazá** la existente (sobrescribe/agrega 3 archivos)
3. GitHub Desktop → commit (ej: "fix pie inteligente codeudor") → **Push**.
4. Esperá 2-3 min el redeploy de Vercel.

## ⚠️ Después del deploy — ejecutá estos 2 comandos en consola (F12)

**1) Crear las 12 reglas de mora en BD:**
```js
fetch('/api/admin/seed-pie-mora', {
  method: 'POST',
  headers: {'Content-Type':'application/json'},
  body: '{}'
}).then(r => r.json()).then(console.log)
```
Respuesta: `"Seed completado: 12 reglas creadas (6 cliente + 6 codeudor)."`

**2) Actualizar los pieEstatico de los templates existentes:**
```js
fetch('/api/admin/reset-mensajes', { method: 'POST' }).then(r => r.json()).then(console.log)
```
Respuesta: `"Templates actualizados con el nuevo pie."`

> 💡 **Importante**: aunque NO ejecutes estos comandos, el sistema **igual va a funcionar** gracias al "pie inteligente de fallback" que ahora genera el tono correcto según los días. Los comandos son para tener las reglas visibles en `Reglas → Pies dinámicos` y poder editarlas.

## 🧪 Después probá
1. Generá mensaje para **BOGARIN** (1032 días) → debe salir el pie **judicial**:
   > "NOTIFICACIÓN LEGAL: La deuda del titular que usted avala, con 1032 días de mora, ha sido derivada al departamento legal..."

2. Generá mensaje para un cliente con pocos días → debe salir pie amable.

3. Andá a **Reglas → Codeudor Pie** → vas a ver las 6 reglas nuevas (si ejecutaste el seed)

✅ TypeScript: 0 errores en los 3 archivos.
