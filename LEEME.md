# FIX PIE BUG — Caetutti Protocol

## 🎯 El problema (CAUSA RAÍZ detectada en el repositorio)

Las reglas PIE no se aplicaban a los mensajes porque había **2 bugs**:

### Bug #1: Mismatch en el nombre del campo `diasAtrasado`

- El endpoint `/api/notificaciones` (parche v3) manda las cuotas con el campo **`diasAtraso`** (sin "d")
- Pero `generarMensajeAgrupado` en `mensajes.ts` busca **`q.diasAtrasado`** (con "d")
- Resultado: `q.diasAtrasado` da `undefined` → se usa `0` → siempre selecciona la regla "0-7 días"

### Bug #2: El endpoint `generar-mensaje` NO recalcula días al vuelo

- Cuando hacés clic en "Ver" para previsualizar, el endpoint carga las cuotas de la DB
- La DB tiene `diasAtrasado` desactualizado (el valor guardado al importar, que no se recalcula)
- Por eso siempre da 0 días y elige la regla amable "0-7 días"

## ✅ La solución

### Archivo 1: `src/app/api/notificaciones/generar-mensaje/route.ts` (REEMPLAZAR)

Fix del endpoint que genera el mensaje de preview:

1. **Recalcula `diasAtrasado` al vuelo** basado en `fechaVcto` vs hoy
2. **Asegura que cada cuota tenga el campo `diasAtrasado`** (con "d") — que es el que usa `generarMensajeAgrupado`
3. Retorna un campo `_diagnostico` con el `maxDiasAtraso` calculado, para que puedas verificar en la consola del navegador

### Archivo 2: `src/app/api/admin/diagnosticar-pie/route.ts` (NUEVO)

Endpoint de diagnóstico y reparación:

**GET /api/admin/diagnosticar-pie** — diagnostica TODO:
- Conteo de reglas por tipo (individual, pie_cliente, pie_codeudor)
- Estado de `usarReglasDinamicas` en TemplateAgrupada y TemplateCodeudor
- Lista de reglas pie_cliente y pie_codeudor con sus rangos
- Muestra de 5 clientes con:
  - `diasEnDB` (lo que está guardado)
  - `diasReales` (lo que debería ser)
  - `discrepancia` (❌ DIFERENTE o ✓ OK)
  - `reglaPieQueDeberiaSeleccionarse` (nombre de la regla)
- Lista de `problemas` detectados

**POST /api/admin/diagnosticar-pie** con `{ arreglar: true }` — repara:
- Pone `usarReglasDinamicas=true` en TemplateAgrupada y TemplateCodeudor
- Activa todas las reglas pie que estén inactivas
- No borra ni modifica mensajes ni rangos

---

## 🚀 Pasos para aplicar

### 1️⃣ Descargá y descomprimí este ZIP

### 2️⃣ Copiar los 2 archivos a tu repo local

**Archivo 1 (reemplazar existente):**
```
src/app/api/notificaciones/generar-mensaje/route.ts
→ ...caetutti-protocol\src\app\api\notificaciones\generar-mensaje\route.ts
```

**Archivo 2 (crear carpeta nueva + archivo):**
```
src/app/api/admin/diagnosticar-pie/route.ts
→ ...caetutti-protocol\src\app\api\admin\diagnosticar-pie\route.ts
```

### 3️⃣ GitHub Desktop — verás 2 archivos:
- `src/app/api/notificaciones/generar-mensaje/route.ts` (modificado)
- `src/app/api/admin/diagnosticar-pie/route.ts` (nuevo)

### 4️⃣ Commit + Push:
- Mensaje: `fix: reglas PIE no se aplicaban — recalcular diasAtrasado al generar mensaje`
- **Commit to main** → **Push origin**

### 5️⃣ Esperá 2-3 min a que Vercel redeploye

---

## 🔍 Cómo diagnosticar (después del deploy)

### Paso 1: Ver el diagnóstico completo

1. Entrá a https://caetutti-protocol.vercel.app (logueate como admin/admin123)
2. Abrí la consola del navegador (**F12** → pestaña **Console**)
3. Pegá este código y dale **Enter**:

```javascript
fetch('/api/admin/diagnosticar-pie')
.then(r => r.json())
.then(data => console.log('🔍 DIAGNÓSTICO:', data))
.catch(e => console.error('❌ Error:', e));
```

4. Vas a ver:
   - Cuántas reglas hay de cada tipo
   - Si `usarReglasDinamicas` está activo
   - Lista de reglas pie con sus rangos
   - 5 clientes de muestra con sus días reales vs los de la DB
   - Lista de problemas detectados

### Paso 2: Arreglar automáticamente

Si el diagnóstico muestra algún ❌, ejecutá:

```javascript
fetch('/api/admin/diagnosticar-pie', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ arreglar: true })
})
.then(r => r.json())
.then(data => console.log('🔧 REPARACIÓN:', data))
.catch(e => console.error('❌ Error:', e));
```

Esto:
- Activa `usarReglasDinamicas=true` en los templates
- Activa todas las reglas pie inactivas

### Paso 3: Recalcular días de la DB (si el diagnóstico muestra discrepancia)

Si el diagnóstico muestra `❌ X de 5 clientes tienen diasAtrasado desactualizado`, ejecutá:

```javascript
fetch('/api/admin/recalcular-dias', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({})
})
.then(r => r.json())
.then(data => console.log('📊 RECALCULAR:', data))
.catch(e => console.error('❌ Error:', e));
```

### Paso 4: Verificar que las reglas funcionan

1. Andá a **Notificaciones** → botón **Ver** de un cliente
2. En la consola del navegador vas a ver el `_diagnostico` con el `maxDiasAtraso` calculado
3. El mensaje que se muestra debe tener el pie correcto según los días reales

---

## 📋 Ejemplo del diagnóstico

Cuando ejecutás `GET /api/admin/diagnosticar-pie`, vas a ver algo así:

```javascript
{
  resumen: {
    totalReglas: 12,
    conteoPorTipo: {
      individual: 0,
      pie_cliente: 6,
      pie_codeudor: 6,
      otras: 0
    },
    templateAgrupada: { usarReglasDinamicas: true, tienePieEstatico: true },
    templateCodeudor: { usarReglasDinamicas: true, tienePieEstatico: true }
  },
  reglasPieCliente: [
    { nombre: "PIE CLIENTE — Por vencer (0-7 días)", diasMinPie: 0, diasMaxPie: 7, ordenPie: 1, activa: true },
    { nombre: "PIE CLIENTE — Vencido leve (8-30 días)", diasMinPie: 8, diasMaxPie: 30, ordenPie: 2, activa: true },
    ...
  ],
  muestraClientes: [
    {
      entidad: "ABADIE SEGOVIA MARCIAL",
      maxDiasReales: 45,
      maxDiasDB: 0,  // ← esto es el problema si difiere
      reglaPieQueDeberiaSeleccionarse: "PIE CLIENTE — Vencido moderado (31-60 días)",
      cuotas: [
        { diasEnDB: 0, diasReales: 45, discrepancia: "❌ DIFERENTE" }
      ]
    }
  ],
  problemas: [
    "❌ 5 de 5 clientes tienen diasAtrasado desactualizado en la DB"
  ]
}
```

Si ves el problema de días desactualizados, ejecutá el `POST /api/admin/recalcular-dias` y listo.

---

## Lo que NO se tocó

- ✅ `src/lib/mensajes.ts` — sin cambios (ya tenía el fix de sustituir variables en el pie)
- ✅ `src/components/modules/reglas.tsx` — sin cambios (la UI funciona bien)
- ✅ `src/app/api/reglas/route.ts` — sin cambios (el endpoint guarda bien el campo `tipo`)
- ✅ Reglas existentes — no se borran ni modifican
- ✅ Templates — no se modifican (solo se activa `usarReglasDinamicas` si estaba apagado)
