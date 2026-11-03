# FIX SUCURSAL DATA — Caetutti Protocol

## 🎯 El problema

El dashboard por sucursal no muestra números separados aunque el código del dashboard ya filtra correctamente. La causa probable: las cuotas y/o clientes tienen `sucursalId = null` en la base de datos (no se asignó correctamente durante el import).

## 🔍 Cómo diagnosticar

Después de aplicar este patch y deployear, ejecutá en la consola del navegador (F12, logueado como admin):

```javascript
fetch('/api/admin/diagnosticar-sucursales')
.then(r => r.json())
.then(data => console.log('🔍 DIAGNÓSTICO:', data))
.catch(e => console.error('❌ Error:', e));
```

Vas a ver:
- Lista de sucursales con ID, nombre y conteo de clientes/cuotas
- Cuántos clientes y cuotas tienen `sucursalId = null`
- Cuántos se pueden reparar tomando el sucursalId del cliente
- Lista de problemas detectados

## 🔧 Cómo reparar

Si el diagnóstico muestra `❌ X cuotas sin sucursalId asignado`, ejecutá:

```javascript
fetch('/api/admin/diagnosticar-sucursales', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ arreglar: true })
})
.then(r => r.json())
.then(data => console.log('🔧 REPARACIÓN:', data))
.catch(e => console.error('❌ Error:', e));
```

Esto repará en 3 fases:
1. **Fase 1**: Cuotas con `sucursalId=null` cuyo cliente SÍ tiene sucursal → copia el sucursalId del cliente
2. **Fase 2**: Clientes con `sucursalId=null` cuyas cuotas SÍ tienen sucursal → copia de la primera cuota
3. **Fase 3**: Los que siguen sin sucursal → los asigna a "Principal"

Después refrescá la página (F5) y el dashboard por sucursal va a funcionar.

## Archivo a agregar

```
src/app/api/admin/diagnosticar-sucursales/route.ts  (NUEVO)
```

## Pasos

1. Descargar y descomprimir este ZIP
2. Copiar `src/app/api/admin/diagnosticar-sucursales/route.ts` al repo local
3. GitHub Desktop → 1 archivo nuevo
4. Commit: `feat: endpoint diagnosticar y reparar sucursalId en cuotas/clientes`
5. Push origin → esperá 2-3 min a que Vercel redeploye
6. Ejecutá el GET para diagnosticar
7. Ejecutá el POST con `{arreglar: true}` para reparar
8. Refrescá la página → el dashboard por sucursal va a funcionar
