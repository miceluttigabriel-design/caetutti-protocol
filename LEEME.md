# 🎯 FIX: "Registrar Codeudor" NO reemplaza el codeudor existente

## ⭐ El bug que reportaste
Cuando un titular ya tiene un codeudor registrado y apretás "Registrar Codeudor"
para agregar otro, el nuevo **reemplaza** al anterior (se borra el 1ro y queda
el 2do en su lugar).

## 🔍 La causa
El botón "Registrar Codeudor" abre el `CodeudorDialog` que hace `PUT /api/clientes/[id]/codeudor`.
Ese endpoint está diseñado para **un solo codeudor por titular** (sistema viejo) —
al guardar, sobrescribe los campos `codeudorNombre/codeudorTelefono` del titular.

Por eso el 2do codeudor pisa al 1ro.

## 🛠️ La solución (sin tocar el sistema viejo)

Ahora cuando un titular **YA tiene codeudor**, aparece un botón nuevo:
> **"¿Necesitás otro garante para este titular?" → [Agregar Otro Garante]**

Ese botón **NO** abre el `CodeudorDialog` (que reemplaza). En su lugar, dispara
un evento que abre el formulario de **AGREGAR GARANTE** (sistema nuevo, tabla
`Garante`, que permite múltiples sin borrar el codeudor principal).

### Flujo nuevo:
1. Titular **SIN codeudor** → botón "Registrar Codeudor" (violeta) → abre
   `CodeudorDialog` → registra el 1er codeudor (sistema viejo, OK)
2. Titular **CON codeudor** → aparece banner "¿Necesitás otro garante?" con
   botón **"Agregar Otro Garante"** → abre formulario de garantes → agrega
   sin borrar el codeudor principal ✅
3. Los garantes adicionales se listan en la sección "Garantes (N)" abajo

## 📦 Solo 1 archivo
- `src/components/modules/notificaciones.tsx`

## 🔧 Cómo aplicar
1. Copiar `src/components/modules/notificaciones.tsx` del ZIP → reemplazar el del repo
2. GitHub Desktop → commit (ej: "registrar codeudor no reemplaza") → **Push**
3. Esperar 2-3 min el deploy

## ⚠️ No hace falta ejecutar nada en consola

## 🧪 Después probá

### Caso 1: Titular sin codeudor (registra el 1ro)
1. Buscá un titular sin codeudor
2. Apretá "Registrar Codeudor" → se abre el dialog violeta
3. Completá → Guardar → queda el 1er codeudor ✓

### Caso 2: Titular CON codeudor (agrega más sin borrar)
1. Buscá un titular que ya tenga codeudor (ej: BOGARIN con SANGALLI)
2. En su tarjeta vas a ver el banner:
   > "¿Necesitás otro garante para este titular?" → **[Agregar Otro Garante]**
3. Apretá ese botón → se abre el formulario de garantes (azul claro)
4. Completá nombre + teléfono → Guardar
5. El nuevo garante queda en la sección "Garantes (N)" abajo
6. **El codeudor principal (SANGALLI) NO se borró** ✓
7. Podés repetir y agregar todos los que quieras

### Importante
- NO apretes "Editar" en el codeudor principal para agregar otro (eso edita el existente)
- Usá siempre el botón **"Agregar Otro Garante"** (azul claro) para sumar más
- Los garantes adicionales se notifican independientemente con su propio botón

## ✅ Conservado intacto
- El codeudor principal (sistema viejo) sigue funcionando igual
- Los garantes existentes no se modifican
- El sistema de notificaciones no se tocó
- La BD ya soporta múltiples garantes (no se modificó el schema)

✅ TypeScript: 0 errores.
