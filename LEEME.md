# 🎯 FIX: Eliminar "Pie estático (fallback)" de la UI

## ⭐ Lo que se eliminó
- ❌ Eliminado el campo **"Pie estático (fallback)"** de la plantilla de **Titular**
- ❌ Eliminado el campo **"Pie estático (fallback)"** de la plantilla de **Codeudor**

Ahora en **Reglas → Plantilla Agrupada** y **Reglas → Plantilla Codeudor** solo ves:
- Cabecera
- Detalle
- Switch "Usar reglas dinámicas para el pie" (sin el campo de pie estático abajo)
- Botón Guardar

## 📦 Solo 1 archivo
- `src/components/modules/reglas.tsx`

## 🔧 Cómo aplicar
1. Copiar `src/components/modules/reglas.tsx` del ZIP → reemplazar el del repo
2. GitHub Desktop → commit (ej: "eliminar pie estatico de UI") → **Push**
3. Esperar 2-3 min el deploy

## 📝 Nota
El campo `pieEstatico` sigue existiendo en la BD (por las dudas) pero ya no se
muestra en la interfaz. El sistema usa SIEMPRE el pie dinámico (reglas) o el
pie inteligente de fallback (según días de atraso), nunca el pieEstatico.

✅ TypeScript: 0 errores.
