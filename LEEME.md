# FIX NOTIFICACIONES V3 — Caetutti Protocol

## 4 problemas resueltos en un solo patch

### 1. ✅ Mostrar TODOS los clientes en Notificaciones
**Antes:** El endpoint filtraba `telefono: { not: null }` → solo mostraba clientes con teléfono.
**Ahora:** Muestra TODOS los clientes con cuotas pendientes, tengan o no teléfono.

### 2. ✅ Eliminar sucursales ficticias automáticamente
**Antes:** Había que ejecutar el endpoint manualmente con un script.
**Ahora:** El endpoint `/api/admin/auto-setup` hace cleanup + recálculo en un solo request.

### 3. ✅ Ordenar por Fecha Vcto (del menos vencido al más vencido)
**Antes:** Ordenaba por `maxDiasAtraso` pero el valor guardado podía estar desactualizado.
**Ahora:**
- Recalcula `diasAtrasado` al vuelo en cada request (basado en `fechaVcto` vs hoy)
- Ordena por `diasAtrasado` ascendente (menos vencido primero)
- Los "Por vencer" (0 días) van primero
- Los poco vencidos (1-30 días) después
- Los muy vencidos (60+ días) al final

### 4. ✅ Recálculo automático diario de los días de atraso
**Antes:** `diasAtrasado` se guardaba al importar y no se actualizaba.
**Ahora:**
- El endpoint `/api/notificaciones` recalcula al vuelo (sin esperar a la DB)
- Actualiza la DB en background (hasta 500 cuotas por request)
- El endpoint `/api/admin/recalcular-dias` hace recálculo masivo completo
- El endpoint `/api/admin/auto-setup` hace cleanup + recálculo en uno solo

---

## Mejoras visuales en las tarjetas

### Tarjeta de Titular (pestaña "Titulares")
Ahora muestra:
- `#código` · **Nombre del cliente** · ⚠ Judicial (si aplica) · ✓ Notificado (si aplica)
- 📞 Teléfono (o "Sin teléfono") · **Vencido hace Xd** / **Por vencer** · **Vcto: DD/MM/AAAA** · Sucursal · últ. notif.
- 💰 Total a cobrar · +interés
- Botones: Ver · Editar · Cliente (WhatsApp)

### Tarjeta de Codeudor (pestaña "Codeudores")
Ahora muestra:
- 👤 Avatar violeta + **Nombre del codeudor** · Badge "Codeudor" · Parentesco
- 📞 Teléfono (o "Sin teléfono")
- **Titular:** `#código` · Nombre · **Vencido hace Xd** / **Por vencer** · **Vcto: DD/MM/AAAA**
- 💰 Total a cobrar · +interés
- Botones: Ver · Notificar · Editar

---

## Archivos a reemplazar / agregar

### 1. `src/app/api/notificaciones/route.ts` (REEMPLAZAR)
- Quita el filtro `telefono: { not: null }`
- Recalcula `diasAtrasado` al vuelo basado en `fechaVcto` vs hoy
- Actualiza la DB en background (hasta 500 cuotas por request)
- Ordena por `diasAtrasado` ascendente (menos vencido primero)
- Expone `montoEditado` e `interesManual` en cada cuota (para el modal de edición)

### 2. `src/app/api/admin/recalcular-dias/route.ts` (NUEVO)
Endpoint POST para recálculo masivo:
- Recorre TODAS las cuotas pendientes
- Recalcula `diasAtrasado`, `interesGs` (si no es manual) y `saldoTotalGs`
- Procesa en lotes de 50 para no sobrecargar la DB
- Requiere permiso de admin

### 3. `src/app/api/admin/auto-setup/route.ts` (NUEVO)
Endpoint POST que ejecuta en un solo request:
- **FASE 1**: Borra las 3 sucursales ficticias
  - "CENTRAL ASUNCION"
  - "SUCURSAL CAPIATA"
  - "SUCURSAL SAN LORENZO"
  - Reasigna clientes/cuotas a "Principal" (la crea si no existe)
- **FASE 2**: Recalcula días e interés de todas las cuotas pendientes
- Requiere permiso de admin

### 4. `src/components/modules/notificaciones.tsx` (REEMPLAZAR)
- Muestra `Vcto: DD/MM/AAAA` (fecha de vencimiento más próxima) en cada tarjeta
- Estado más claro: "Por vencer" / "Vencido hace Xd" (en vez de "Xd atraso")
- Mantiene TODO lo anterior: pestañas, codeudores aparte, editar montos, etc.

---

## Pasos para aplicar

### 1️⃣ Descargá y descomprimí este ZIP

### 2️⃣ Copiar los 4 archivos a tu repo local

**Archivo 1 (reemplazar existente):**
```
src/app/api/notificaciones/route.ts
→ ...caetutti-protocol\src\app\api\notificaciones\route.ts
```

**Archivo 2 (reemplazar existente):**
```
src/components/modules/notificaciones.tsx
→ ...caetutti-protocol\src\components\modules\notificaciones.tsx
```

**Archivo 3 (crear carpetas nuevas + archivo):**
```
src/app/api/admin/recalcular-dias/route.ts
→ ...caetutti-protocol\src\app\api\admin\recalcular-dias\route.ts
```

**Archivo 4 (crear carpeta nueva + archivo):**
```
src/app/api/admin/auto-setup/route.ts
→ ...caetutti-protocol\src\app\api\admin\auto-setup\route.ts
```

> Si ya habías aplicado el patch `fix-codeudores-v2.zip` con el archivo `cleanup-sucursales`, podés dejarlo o borrarlo — `auto-setup` es más completo y lo reemplaza.

### 3️⃣ GitHub Desktop — verás 4 archivos:
- `src/app/api/notificaciones/route.ts` (modificado)
- `src/components/modules/notificaciones.tsx` (modificado)
- `src/app/api/admin/recalcular-dias/route.ts` (nuevo)
- `src/app/api/admin/auto-setup/route.ts` (nuevo)

### 4️⃣ Commit + Push:
- Mensaje: `feat: todos los clientes + orden por vencimiento + recálculo diario + cleanup sucursales`
- **Commit to main** → **Push origin**

### 5️⃣ Esperá 2-3 min a que Vercel redeploye

---

## 🧹 Cómo ejecutar el cleanup + recálculo (después del deploy)

Esto borra las 3 sucursales ficticias Y recalcula los días de todas las cuotas en un solo paso.

1. Entrá a https://caetutti-protocol.vercel.app (logueate como admin/admin123)
2. Abrí la consola del navegador (**F12** → pestaña **Console**)
3. Pegá este código y dale **Enter**:

```javascript
fetch('/api/admin/auto-setup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({})  // usa defaults: 3 sucursales ficticias + recálculo completo
})
.then(r => r.json())
.then(data => console.log('✅ Auto-setup completado:', data))
.catch(e => console.error('❌ Error:', e));
```

4. Vas a ver en la consola algo como:
```
✅ Auto-setup completado: {
  mensaje: "Auto-setup completado: sucursales limpias + días recalculados",
  fase1_sucursales: {
    sucursalDestino: "Principal",
    resultados: [
      { nombre: "CENTRAL ASUNCION", encontrada: true, clientesMovidos: 234, cuotasMovidas: 410, borrada: true },
      { nombre: "SUCURSAL CAPIATA", encontrada: true, clientesMovidos: 187, cuotasMovidas: 322, borrada: true },
      { nombre: "SUCURSAL SAN LORENZO", encontrada: true, clientesMovidos: 156, cuotasMovidas: 287, borrada: true }
    ]
  },
  fase2_recalculo: {
    totalCuotas: 1500,
    actualizadas: 1450,
    sinCambios: 50,
    errores: 0,
    fechaCalculo: "2026-11-03T00:00:00.000Z"
  }
}
```

5. Refrescá la página (F5) → vas a ver:
   - ✅ Todas las sucursales ficticias desaparecieron del dropdown
   - ✅ Todos los clientes aparecen en Notificaciones (con o sin teléfono)
   - ✅ Ordenados del menos vencido al más vencido
   - ✅ Los días de atraso están actualizados a hoy
   - ✅ Cada tarjeta muestra "Vcto: DD/MM/AAAA"

---

## 🔁 Recálculo diario (sin borrar sucursales)

Si en el futuro solo querés recalcular los días (sin tocar sucursales), usá:

```javascript
fetch('/api/admin/recalcular-dias', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({})
})
.then(r => r.json())
.then(data => console.log('✅ Recálculo:', data))
.catch(e => console.error('❌ Error:', e));
```

> Importante: El endpoint `/api/notificaciones` ya recalcula al vuelo en cada request, así que esto solo es necesario si querés forzar la actualización de la DB (por ejemplo, para que los reportes y el dashboard usen valores frescos).

---

## Lo que NO se tocó (preservado)

- ✅ Pestañas "Titulares" / "Codeudores" — funcionan igual
- ✅ CodeudorDialog (editar/eliminar codeudor) — funciona igual
- ✅ NuevoCodeudorDialog (registrar codeudor buscando titular) — funciona igual
- ✅ NotifDetalle (ver detalle con preview) — funciona igual
- ✅ EditMontoDialog (editar saldos e intereses) — funciona igual
- ✅ Stats (Total, Sin teléfono, Con codeudor, Total a cobrar) — sin cambios
- ✅ Buscador — funciona en ambas pestañas
- ✅ Switch "Ocultar notificados" — sin cambios
- ✅ Flag `esCodeudorGarante: true` al notificar codeudor — sin cambios
- ✅ Base de datos — no se modifica el schema, solo se actualizan valores
