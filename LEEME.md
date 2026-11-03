# FIX SYNC SUCURSAL — Caetutti Protocol

## 🎯 El problema (CAUSA RAÍZ confirmada)

El dashboard muestra:
- ✅ Clientes Activos: 698 (el filtro SÍ funciona para clientes)
- ❌ Total Pendiente: ₲0 (las cuotas NO se filtran bien)
- ❌ Todos los demás KPIs: 0

**Causa raíz:** Los clientes SÍ tienen `sucursalId` asignado, pero las cuotas NO tienen el mismo `sucursalId` que su cliente. Por eso cuando seleccionás KATUETE:
- `db.cliente.count({ where: { sucursalId: KATUETE_ID } })` → 698 ✓
- `db.cuota.findMany({ where: { sucursalId: KATUETE_ID, estado: "pendiente" } })` → 0 ❌

## ✅ La solución

Endpoint `/api/admin/sync-sucursales` que:
1. **Diagnóstico** (GET o POST sin `ejecutar`): muestra cuántas cuotas están desalineadas
2. **Sincronización** (POST con `ejecutar: true`):
   - Para cada cuota, copia el `sucursalId` de su cliente
   - Para cada cliente sin `sucursalId`, toma el de sus cuotas
   - Los que siguen sin sucursal → los asigna a "Principal"

## Archivo a agregar

```
src/app/api/admin/sync-sucursales/route.ts  (NUEVO)
```

## Pasos

### 1. Descargar y descomprimir este ZIP

### 2. Copiar el archivo al repo local
```
src/app/api/admin/sync-sucursales/route.ts
→ ...caetutti-protocol\src\app\api\admin\sync-sucursales\route.ts
```
(Crear la carpeta `sync-sucursales/`)

### 3. GitHub Desktop → 1 archivo nuevo
- Mensaje: `fix: sincronizar sucursalId de cuotas con el de su cliente`
- Commit to main → Push origin

### 4. Esperar 2-3 min a que Vercel redeploye

---

## 🔍 PASO 1 — Diagnóstico (después del deploy)

En la consola del navegador (F12, logueado como admin), pegá:

```javascript
fetch('/api/admin/sync-sucursales')
.then(r => r.json())
.then(data => console.log('🔍 DIAGNÓSTICO:', data))
.catch(e => console.error('❌ Error:', e));
```

Vas a ver algo como:
```
🔍 DIAGNÓSTICO: {
  diagnosticoCuotas: {
    totalCuotas: 2797,
    cuotasConSucursalId: 500,
    cuotasSinSucursalId: 2297,  // ← PROBLEMA
    cuotasConSucursalIgualCliente: 200,
    cuotasConSucursalDiferenteCliente: 300,  // ← PROBLEMA
    cuotasSinClienteSucursal: 2297
  },
  reporteSucursales: [
    { nombre: "KATUETE", clientes: 698, cuotas: 0, cuotasPendientes: 0 },  // ← ASIMETRÍA
    { nombre: "NUEVA ESPERANZA", clientes: 200, cuotas: 0, cuotasPendientes: 0 }
  ]
}
```

## 🔧 PASO 2 — Sincronización

Si el diagnóstico muestra cuotas desalineadas, ejecutá:

```javascript
fetch('/api/admin/sync-sucursales', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ejecutar: true })
})
.then(r => r.json())
.then(data => console.log('✅ SINCRONIZADO:', data))
.catch(e => console.error('❌ Error:', e));
```

Vas a ver:
```
✅ SINCRONIZADO: {
  mensaje: "Sincronización completada — el dashboard por sucursal debería funcionar ahora",
  acciones: [
    "✅ 2597 cuotas sincronizadas con el sucursalId de su cliente",
    "✅ 0 clientes sincronizados con el sucursalId de sus cuotas",
    "✅ 200 cuotas sin sucursal asignadas a 'Principal'"
  ],
  reporteSucursales: [
    { nombre: "KATUETE", clientes: 698, cuotas: 850, cuotasPendientes: 720 },
    { nombre: "NUEVA ESPERANZA", clientes: 200, cuotas: 250, cuotasPendientes: 200 }
  ]
}
```

## ✅ PASO 3 — Verificar

Refrescá la página (F5), andá al dashboard, seleccioná KATUETE:
- ✅ Total Pendiente ya NO es ₲0 — muestra el total de KATUETE
- ✅ Tasa de Cobranza calculada sobre las ventas de KATUETE
- ✅ % Recuperado del Mes calculado sobre las cuotas de KATUETE
- ✅ Gráficos muestran datos
