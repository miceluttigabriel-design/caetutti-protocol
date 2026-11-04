# 🎯 FIX: Selección de regla de pie CORRECTA según días de atraso

## ⭐ El bug que seguías viendo
BOGARIN con **1032 días** de atraso recibía el pie **amable** (0-7 días) en vez del pie **judicial** (181+ días).

## 🔍 La causa raíz (esta vez SÍ la encontré)

El bug estaba en `seleccionarPieDinamico()`:

```js
const max = r.diasMaxPie ?? -1;  // si es null → -1
if (max === -1) {
  if (diasAtraso >= min) return r.mensaje;  // ⚠️ PROBLEMA
}
```

Si alguna regla tenía `diasMaxPie: null` (porque se guardó mal o el schema lo permite), el código la trataba como "rango abierto" → la **primera** regla con `diasMinPie: 0` atrapaba TODOS los casos (0 días, 1032 días, lo que sea).

Por eso BOGARIN con 1032 días recibía el pie de 0-7 días.

## 🛠️ La solución — Priorizar rangos CERRADOS sobre ABIERTOS

Nueva lógica de `seleccionarPieDinamico`:

1. **PRIMERO** busca reglas con `diasMaxPie` numérico positivo (0-7, 8-30, 31-60, etc.)
   → si alguna coincide (`min <= diasAtraso <= max`), la usa
2. **RECIÉN DESPUÉS** busca reglas con `diasMaxPie = -1` o `null` (rango abierto: 181+ días)
   → si alguna coincide (`diasAtraso >= min`), la usa

Así, para BOGARIN con 1032 días:
- ✅ No entra en 0-7 (max=7, 1032>7)
- ✅ No entra en 8-30, 31-60, 61-90, 91-180 (todos max < 1032)
- ✅ SÍ entra en 181+ (rango abierto, 1032 >= 181) → **pie judicial** ✓

## 📦 El ZIP trae SOLO 1 archivo
- `src/lib/mensajes.ts`

## 🔧 Cómo aplicar

1. Abrí la carpeta del repo: `C:\Users\usuario\OneDrive\Documentos\GitHub\viza-home-sistema\caetutti-protocol`
2. Copiá `src/lib/mensajes.ts` de este ZIP y **reemplazá** el existente
3. GitHub Desktop → commit (ej: "fix seleccion regla pie por rango") → **Push**.
4. Esperá 2-3 min el redeploy de Vercel.

## 🧪 Después probá
Generá mensaje para **BOGARIN** (1032 días) → debe salir el pie **judicial**:

> "NOTIFICACIÓN LEGAL: La deuda del titular que usted avala, con **1032 días** de mora, ha sido derivada al departamento legal. Como codeudor/garante solidario, será demandado judicialmente junto con el titular..."

Y un cliente con 3 días → pie amable.
Y un cliente con 45 días → pie firme.
Y un cliente con 200 días → pie judicial.

## 📝 Notas
- **No hace falta ejecutar `seed-pie-mora` otra vez** — las reglas ya están en la BD
- **No hace falta ejecutar `reset-mensajes`** — el `pieEstatico` ya no se usa (el pie inteligente siempre devuelve algo)
- Si querés editar las reglas a mano, andá a **Reglas → Pies dinámicos**

✅ TypeScript: 0 errores.
