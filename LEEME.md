# FIX DASHBOARD — Caetutti Protocol

## 2 problemas resueltos

### 1️⃣ Dashboard no funcionaba por sucursal
**Antes:** La query de `ventasMes` NO respetaba el filtro de sucursal — siempre traía todas las ventas de la empresa, sin importar qué sucursal estuvieras mirando.

**Ahora:** Todas las queries (cuotas, clientes, ventasMes, cuotas del mes) respetan el filtro de sucursal seleccionado en el dropdown. Si elegís "NUEVA ESPERANZA", solo cuenta los datos de esa sucursal.

### 2️⃣ "Salud de Cobranza" → "Total % Recuperado del Mes"
**Antes:** "Salud de Cobranza" calculaba `(totalVendido - totalPendiente) / totalVendido * 100` sobre el total histórico acumulado.

**Ahora:** Calcula el **% recuperado dentro del mes actual** (del 01 al último día del mes):

```
% Recuperado = (monto cobrado del mes / monto total del mes) * 100
```

Donde:
- **monto cobrado del mes** = suma de `saldoGs` de cuotas con `fechaVcto` en el mes actual y `estado = "cobrada"`
- **monto total del mes** = suma de todas las cuotas (cobradas + pendientes) con `fechaVcto` en el mes actual
- **período** = desde el día 1 del mes actual hasta el último día del mes actual

Ejemplo: hoy es 03/11/2026 → el cálculo considera todas las cuotas con `fechaVcto` entre **01/11/2026** y **30/11/2026**.

---

## Archivos a reemplazar

### 1. `src/app/api/dashboard/route.ts` (REEMPLAZAR)

Cambios:
- ✅ Aplica filtro de sucursal a TODAS las queries (incluyendo `ventasMes`)
- ✅ Agrega query de `cuotasDelMes` — busca cuotas con `fechaVcto` entre el 01 y el último día del mes actual
- ✅ Calcula `pctRecuperado`, `montoCobrado`, `montoPendiente`, `montoTotal` para el mes
- ✅ Retorna objeto `mes` con el período (fechas de inicio/fin) para mostrar en la UI
- ✅ Respeta filtro de sucursal cuando se selecciona una específica

### 2. `src/components/modules/dashboard.tsx` (REEMPLAZAR)

Cambios:
- ✅ Reemplaza "Salud de Cobranza" por **"Total % Recuperado del Mes"** con ícono de calendario
- ✅ Muestra el período activo: `Noviembre 2026 · 01/11/2026 → 30/11/2026`
- ✅ Muestra monto cobrado, monto pendiente y totales del mes
- ✅ Muestra conteo de cuotas: `X cobradas · Y pendientes · Z total`
- ✅ Mensaje de estado: Excelente / Aceptable / Requiere atención / Crítico
- ✅ Mantiene TODOS los demás elementos: KPIs principales, charts, resumen operativo

---

## Pasos para aplicar

### 1️⃣ Descargá y descomprimí este ZIP

### 2️⃣ Copiar los 2 archivos a tu repo local

**Archivo 1 (reemplazar existente):**
```
src/app/api/dashboard/route.ts
→ ...caetutti-protocol\src\app\api\dashboard\route.ts
```

**Archivo 2 (reemplazar existente):**
```
src/components/modules/dashboard.tsx
→ ...caetutti-protocol\src\components\modules\dashboard.tsx
```

### 3️⃣ GitHub Desktop — verás 2 archivos:
- `src/app/api/dashboard/route.ts` (modificado)
- `src/components/modules/dashboard.tsx` (modificado)

### 4️⃣ Commit + Push:
- Mensaje: `feat: dashboard por sucursal + % recuperado del mes actual`
- **Commit to main** → **Push origin**

### 5️⃣ Esperá 2-3 min a que Vercel redeploye

---

## ✅ Cómo verificar que funciona

### Dashboard por sucursal

1. Andá al dashboard principal
2. En el dropdown de sucursales (arriba a la derecha), elegí una sucursal específica (ej: NUEVA ESPERANZA)
3. Los KPIs deben reflejar SOLO los datos de esa sucursal:
   - Total Pendiente
   - Tasa de Cobranza (sobre el vendido de ESA sucursal)
   - Crítico (+30 días)
   - Clientes Activos
4. Cambiá a otra sucursal → los números deben cambiar
5. Cambiá a "Todas las sucursales" → muestra el total agregado

### % Recuperado del Mes

1. En el dashboard vas a ver la nueva barra: **"Total % Recuperado del Mes"**
2. Debajo del porcentaje, vas a ver el período activo:
   ```
   noviembre 2026 · 01/11/2026 → 30/11/2026
   ```
3. A la derecha vas a ver:
   ```
   Cobrado del mes: ₲ X
   Pendiente del mes: ₲ Y
   A cobradas · B pendientes · C total
   ```
4. El porcentaje se calcula: `cobrado / (cobrado + pendiente) * 100`

### Lógica del cálculo

- **Cuota "cobrada" del mes**: tiene `fechaVcto` en el mes actual y `estado = "cobrada"`
- **Cuota "pendiente" del mes**: tiene `fechaVcto` en el mes actual y `estado = "pendiente"`
- **% recuperado** = monto cobrado / monto total * 100

> Importante: las cuotas se marcan como "cobradas" cuando no vienen en una nueva importación del Excel (el cliente ya pagó) o cuando el saldo es 0. Por eso, mientras más importes el Excel actualizado, más preciso va a ser el % recuperado.

---

## 📋 Ejemplo visual

```
┌─────────────────────────────────────────────────────────┐
│ 📅 TOTAL % RECUPERADO DEL MES                  72.5%    │
│ noviembre 2026 · 01/11/2026 → 30/11/2026                │
│                                          Cobrado del mes│
│ ████████████████░░░░░░░░░░░░░░░░         ₲ 1.2B         │
│                                          Pendiente del mes│
│ ⚠ Recuperación aceptable · sobre ₲ 1.7B   ₲ 500M       │
│ totales del mes                           234 cobradas  │
│                                           · 89 pendientes│
│                                           · 323 total   │
└─────────────────────────────────────────────────────────┘
```

---

## Lo que NO se tocó

- ✅ KPIs principales (Total Pendiente, Tasa de Cobranza, Crítico, Clientes Activos) — sin cambios
- ✅ Charts (Distribución por Antigüedad, Cuotas por Tramo) — sin cambios
- ✅ Resumen operativo (Notificadas, Sin Notificar, Recordatorios, Notifs. Enviadas) — sin cambios
- ✅ Recálculo automático de interés y días — sin cambios
- ✅ Filtro de sucursal del usuario (no admin) — sin cambios (sigue limitado a su sucursal)
