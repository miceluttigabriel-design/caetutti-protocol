# 🎯 FIX: WhatsApp del Codeudor usa SU teléfono (no el del titular)

## ⭐ El bug
Cuando apretabas "Notificar" en el codeudor, el mensaje se abría en WhatsApp con
el número del **titular**, no con el número del codeudor que cargaste.

## 🔍 La causa
2 problemas combinados:

1. **Al seleccionar un cliente sugerido como codeudor**, el código copiaba su
   teléfono automáticamente. Si el usuario seleccionaba al titular (o un cliente
   con el mismo teléfono), el codeudor quedaba con el teléfono del titular.

2. **`abrirWhatsappCodeudor` no validaba** que el teléfono del codeudor sea
   distinto al del titular. Si eran iguales, abría WhatsApp con ese número
   (que era el del titular).

## 🛠️ La solución (sin tocar nada más)

### 1. `abrirWhatsappCodeudor` — Validación de seguridad
- Usa SIEMPRE `cliente.codeudor.telefono` (no fallback al titular)
- Si el codeudor no tiene teléfono → avisa y NO abre WhatsApp
- **Si el teléfono del codeudor es igual al del titular** → avisa y NO abre WhatsApp:
  > "El teléfono del codeudor es igual al del titular. Editá el codeudor con su número correcto."
- El toast de éxito ahora muestra el número: `"Abriendo WhatsApp para SANGALLI (595986674686)"`

### 2. `seleccionarSugerido` — No copiar teléfono si es igual al del titular
- Al seleccionar un cliente sugerido como codeudor, si su teléfono es igual al
  del titular, NO se copia (queda vacío para que el usuario lo cargue manualmente)
- Avisa con toast: "El cliente seleccionado tiene el mismo teléfono que el titular. Cargá el teléfono del codeudor manualmente."

## 📦 Solo 1 archivo
- `src/components/modules/notificaciones.tsx`

## 🔧 Cómo aplicar
1. Copiar `src/components/modules/notificaciones.tsx` del ZIP → reemplazar el del repo
2. GitHub Desktop → commit (ej: "fix whatsapp codeudor usa su telefono") → **Push**
3. Esperar 2-3 min el deploy

## ⚠️ No hace falta ejecutar nada en consola

## 🧪 Después probá

### Caso 1: Codeudor con teléfono distinto al titular
1. Editá el codeudor → cargá un número DISTINTO al del titular → Guardar
2. Apretá "Notificar" en el codeudor
3. WhatsApp se abre con el número del CODEUDOR ✓
4. El toast dice: "Abriendo WhatsApp para SANGALLI (595XXXXXXXX)"

### Caso 2: Codeudor con teléfono igual al titular (bug actual de SANGALLI)
1. Apretá "Notificar" en el codeudor SANGALLI (que tiene el mismo teléfono que BOGARIN)
2. Aparece toast: "El teléfono del codeudor es igual al del titular. Editá el codeudor con su número correcto."
3. NO se abre WhatsApp → tenés que editar el codeudor y poner el número correcto

### Caso 3: Seleccionar cliente sugerido con mismo teléfono
1. Al buscar un cliente para agregar como codeudor, si tiene el mismo teléfono que el titular
2. El teléfono NO se autocompleta → queda vacío
3. Toast de advertencia → cargás el teléfono manualmente

## ✅ Conservado intacto
- El WhatsApp del TITULAR sigue funcionando igual (usa `cliente.telefono`)
- Los codeudores en Notificaciones siguen figurando igual
- El resto del sistema no se tocó

✅ TypeScript: 0 errores.
