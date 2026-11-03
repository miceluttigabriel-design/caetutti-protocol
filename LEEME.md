# FIX CODEUDORES V2 — Caetutti Protocol

## 3 cambios solicitados

1. **Eliminar la opción "Agregar Garante"** en la pestaña Titulares
2. **Crear codeudor desde la pestaña Codeudores** con búsqueda de titular para vincular
3. **Borrar las sucursales** "CENTRAL ASUNCION", "SUCURSAL CAPIATA", "SUCURSAL SAN LORENZO"

---

## Archivos a reemplazar / agregar

### 1. `src/components/modules/notificaciones.tsx` (REEMPLAZAR)

Cambios realizados:

#### Eliminar Garantes de Titulares
- ❌ Eliminada la fila `<GarantesSection cliente={cliente} />` de NotifCard
- ❌ Eliminada la función `GarantesSection` (código muerto)
- ❌ Eliminada la función `GaranteEditInline` (código muerto)
- ✅ La pestaña "Titulares" ahora muestra SOLO: nombre del cliente, teléfono, deuda, botones Ver/Editar/Cliente
- ✅ Sin "Sin garantes adicionales", sin "Agregar Garante"

#### Crear Codeudor desde pestaña "Codeudores"
- ✅ Agregado botón "Registrar Codeudor" arriba de la lista de codeudores
- ✅ Cuando no hay codeudores, se muestra un placeholder con el botón
- ✅ Nuevo componente `NuevoCodeudorDialog` con flujo de 2 pasos:
  - **Paso 1**: Buscar titular (por nombre, código, CI o teléfono) → seleccionar
  - **Paso 2**: Llenar datos del codeudor (nombre *, teléfono, CI, parentesco) → guardar
- ✅ Usa el endpoint existente `PUT /api/clientes/{titularId}/codeudor`
- ✅ Botón "← Cambiar titular" para volver al paso 1 si te equivocaste
- ✅ Botón "← Atrás" en paso 2 para cambiar de titular

### 2. `src/app/api/admin/cleanup-sucursales/route.ts` (NUEVO)

Endpoint POST para borrar sucursales no deseadas:
- Recibe: `{ sucursales: ["CENTRAL ASUNCION", "SUCURSAL CAPIATA", ...] }`
- Para cada sucursal:
  1. Busca la sucursal (case-insensitive)
  2. Reasigna todos sus clientes y cuotas a la sucursal "Principal" (la crea si no existe)
  3. Reasigna ventasMes y objetivos dinámicos
  4. Borra la sucursal
- Requiere sesión de admin (rol: "admin")
- Retorna: lista de resultados con cuántos clientes/cuotas movió cada una

---

## Pasos para aplicar

### 1️⃣ Descargá y descomprimí este ZIP

### 2️⃣ Copiar los archivos a tu repo local

**Archivo 1 (reemplazar existente):**
```
src/components/modules/notificaciones.tsx
→ C:\Users\usuario\OneDrive\Documentos\GitHub\viza-home-sistema\caetutti-protocol\src\components\modules\notificaciones.tsx
```

**Archivo 2 (crear carpeta nueva + archivo):**
```
src/app/api/admin/cleanup-sucursales/route.ts
→ C:\Users\usuario\OneDrive\Documentos\GitHub\viza-home-sistema\caetutti-protocol\src\app\api\admin\cleanup-sucursales\route.ts
```
(Las carpetas `admin/` y `cleanup-sucursales/` no existen todavía — crealas)

### 3️⃣ GitHub Desktop — verás 2 archivos:
- `src/components/modules/notificaciones.tsx` (modificado)
- `src/app/api/admin/cleanup-sucursales/route.ts` (nuevo)

### 4️⃣ Commit + Push:
- Mensaje: `feat: elimina garantes titular + crear codeudor + cleanup sucursales`
- **Commit to main** → **Push origin**

### 5️⃣ Esperá 2-3 min a que Vercel redeploye

---

## Cómo borrar las 3 sucursales

Después del deploy, abrí el navegador y entrá a (logueado como admin):

### Opción A — Por URL directa

Visitá esta URL en el navegador (reemplazando por tu URL real):

```
https://caetutti-protocol.vercel.app/api/admin/cleanup-sucursales
```

Pero como es un POST, no podés abrirlo directamente. Mejor usar la consola del navegador:

### Opción B — Por consola del navegador (recomendada)

1. Entrá a https://caetutti-protocol.vercel.app (logueate como admin/admin123)
2. Abrí la consola del navegador (F12 → pestaña "Console")
3. Pegá este código y dale Enter:

```javascript
fetch('/api/admin/cleanup-sucursales', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sucursales: ['CENTRAL ASUNCION', 'SUCURSAL CAPIATA', 'SUCURSAL SAN LORENZO']
  })
})
.then(r => r.json())
.then(data => console.log('✅ Resultado:', data))
.catch(e => console.error('❌ Error:', e));
```

4. Vas a ver en la consola algo como:
```
✅ Resultado: {
  mensaje: "Limpieza de sucursales completada",
  sucursalDestino: "Principal",
  resultados: [
    { nombre: "CENTRAL ASUNCION", encontrada: true, clientesMovidos: 234, cuotasMovidas: 410, borrada: true },
    { nombre: "SUCURSAL CAPIATA", encontrada: true, clientesMovidos: 187, cuotasMovidas: 322, borrada: true },
    { nombre: "SUCURSAL SAN LORENZO", encontrada: true, clientesMovidos: 156, cuotasMovidas: 287, borrada: true }
  ]
}
```

5. Refrescá la página y verificá que las sucursales ya no aparecen en el dropdown de sucursales del dashboard.

### ¿Qué pasa con los clientes/cuotas de esas sucursales?

No se pierden. Se mueven a la sucursal "Principal". Después podés:
- Dejarlos ahí en "Principal"
- O crear las sucursales reales que sí usan y mover los clientes manualmente

---

## Cómo usar la nueva UI de Notificaciones

### Pestaña "Titulares" (verde)
- Lista limpia de clientes
- Solo: nombre, código, teléfono, deuda, días atraso
- Botones: Ver / Editar / Cliente (WhatsApp)
- **SIN "Agregar Garante"** (eliminado)
- **SIN fila de codeudor debajo** (eliminado en patch anterior)

### Pestaña "Codeudores" (violeta)
- Arriba: tarjeta "Gestión de Codeudores" con botón **"Registrar Codeudor"**
- Lista de codeudores existentes (cada uno con su titular asociado)
- Botones por codeudor: Ver / Notificar / Editar

### Crear codeudor nuevo
1. Pestaña "Codeudores" → botón **"Registrar Codeudor"**
2. **Paso 1**: buscá al titular por nombre, código, CI o teléfono → clic en el resultado
3. **Paso 2**: llená los datos del codeudor (nombre es obligatorio) → **"💾 Registrar Codeudor"**
4. El codeudor queda vinculado al titular y aparece en la lista

---

## Lo que NO se tocó (preservado)

- ✅ CodeudorDialog (editar/eliminar codeudor existente) — funciona igual
- ✅ NotifDetalle (ver detalle con preview de mensaje) — funciona igual
- ✅ EditMontoDialog (editar saldos e intereses) — funciona igual
- ✅ CodeudorCard (tarjeta de codeudor en pestaña) — funciona igual
- ✅ Stats (Total, Sin teléfono, Con codeudor, Total a cobrar) — sin cambios
- ✅ Buscador — funciona en ambas pestañas
- ✅ Switch "Ocultar notificados" — sin cambios
- ✅ Flag `esCodeudorGarante: true` al notificar — sin cambios (no marca cuotas del titular como notificadas)
- ✅ Base de datos — no se toca nada, solo se borran las 3 sucursales al llamar al endpoint
