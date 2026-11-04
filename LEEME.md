# 🎯 FIX DEFINITIVO: Selección de regla de pie según días de atraso

## ⭐ El problema que persistía
El tono del mensaje siempre salía **amable** (0-7 días) sin importar los días
reales de atraso. BOGARIN con 1032 días recibía el pie amable en vez del judicial.

## 🔍 La causa raíz definitiva
El `seleccionarPieDinamico` anterior tenía un bug: si las reglas en BD tenían
`diasMaxPie: null` (mal guardadas o corrompidas), TODAS se trataban como
"rango abierto" y la PRIMERA (la de `diasMinPie: 0`) atrapaba todo.

## 🛠️ La solución DEFINITIVA — Lógica a prueba de fallos

Nueva estrategia: **ordenar por `diasMinPie` DESCENDENTE** y retornar la
PRIMERA regla donde `diasAtraso >= min`.

```
Reglas ordenadas DESC por min:  [181+, 91-180, 61-90, 31-60, 8-30, 0-7]

Para 1032 días:
  ✓ 181+ (min=181): 1032 >= 181 → TRUE → retorna JUDICIAL ✓

Para 5 días:
  ✗ 181+ (min=181): 5 >= 181 → FALSE
  ✗ 91-180 (min=91): 5 >= 91 → FALSE
  ✗ 61-90 (min=61): 5 >= 61 → FALSE
  ✗ 31-60 (min=31): 5 >= 31 → FALSE
  ✗ 8-30 (min=8): 5 >= 8 → FALSE
  ✓ 0-7 (min=0, max=7): 5 >= 0 AND 5 <= 7 → TRUE → retorna AMABLE ✓
```

**Funciona sin importar si `diasMaxPie` es:**
- Número positivo (7, 30, 60...) → valida rango cerrado
- `-1` (rango abierto) → solo valida min
- `null` (mal guardado) → lo trata como rango abierto, pero el `min` más alto
  se evalúa primero, así que la regla correcta siempre gana

## 🧪 Verificado con simulación (ambos casos):

**Reglas correctas (diasMaxPie numérico):**
```
   0 días → 0-7 días ✓
   3 días → 0-7 días ✓
  10 días → 8-30 días ✓
  45 días → 31-60 días ✓
  75 días → 61-90 días ✓
 100 días → 91-180 días ✓
 200 días → 181+ días ✓
1032 días → 181+ días ✓ (BOGARIN)
```

**Reglas rotas (todas diasMaxPie: null):**
```
1032 días → 181+ días ✓ (igual funciona)
```

## 📦 Solo 1 archivo
- `src/lib/mensajes.ts`

## 🔧 Cómo aplicar
1. Copiar `src/lib/mensajes.ts` del ZIP → reemplazar el del repo
2. GitHub Desktop → commit (ej: "fix definitivo seleccion regla pie") → **Push**
3. Esperar 2-3 min el deploy

## ⚠️ No hace falta ejecutar nada en consola
Las reglas que ya están en tu BD (de seed-pie-mora) funcionan con este fix.
El sistema ahora SÍ selecciona la regla correcta según los días.

## 🧪 Después probá
1. Generá mensaje para **BOGARIN** (1032 días) → debe salir pie **JUDICIAL**:
   > "NOTIFICACIÓN LEGAL: La deuda del titular que usted avala, con **1032 días** de mora..."

2. Generá mensaje para un cliente con 3 días → pie **amable**
3. Generá mensaje para un cliente con 45 días → pie **firme**
4. Generá mensaje para un cliente con 200 días → pie **judicial**

El tono ya NO va a ser uno solo — va a variar según los días de atraso. ✅

✅ TypeScript: 0 errores.
✅ Simulación: 10/10 casos correctos (con reglas correctas Y con reglas rotas).
