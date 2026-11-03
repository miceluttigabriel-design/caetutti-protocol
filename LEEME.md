# FIX IMPORT EXCEL — Caetutti Protocol

## Problema
La importación del Excel falla con 2801 errores:
```
Cliente sin codigoEntidad o entidad
```

## Causa raíz
El front-end `src/components/modules/importar.tsx` lee el Excel con `XLSX.utils.sheet_to_json()`
y envía las filas al backend envueltas como `{ clientes: [...filas...] }`.

Pero las filas del Excel tienen **keys con espacios** ("Codigo Entidad", "Entidad", "Fecha Vcto"),
mientras que el backend `/api/import` en modo JSON estructurado espera **keys camelCase**
(`codigoEntidad`, `entidad`, `cuotas: [...]`).

Resultado: TODAS las filas fallan porque `c.codigoEntidad` es `undefined` para el backend.

## Solución
Se agregó una función `filasExcelAClientes(rows)` en el front-end que:

1. Lee cada fila del Excel con sus keys originales ("Codigo Entidad", "Entidad", etc.)
2. Agrupa las filas por `Codigo Entidad` en un Map
3. Para cada cliente crea un objeto:
   ```js
   {
     codigoEntidad: "52813",
     entidad: "AGUILERA PEREIRA, ROLAN MOISES",
     telefono: "0986101358",
     // ...otros campos
     cuotas: [{ fechaVcto, saldoGs, ... }, ...]
   }
   ```
4. Cada fila del Excel se convierte en una cuota del cliente correspondiente
5. Las filas vacías o de "TOTAL" se ignoran silenciosamente

Esta estructura `{ clientes: [...] }` es exactamente lo que el backend espera en
su camino `importStructured()` (línea 226-393 de src/app/api/import/route.ts),
que tiene toda la lógica de:
- Re-importación sin pisar montos editados
- Marcar como cobradas las cuotas que no vinieron en el Excel nuevo
- Recalcular interés e días automáticamente
- Preservar `notificado`, `ultimaNotificacion`, `montoEditado`, `interesManual`

## Beneficios adicionales
- **Agrupa cuotas por cliente** → menos queries a la DB (1 findUnique + N inserts vs N×3 queries)
- **Respeta la lógica de "no vino → cobrada"** que espera la estructura anidada
- **Mantiene el chunking** (100 clientes por lote) para evitar timeout de Vercel
- **Maneja JSON en ambos formatos**: estructura anidada o array plano de filas Excel

## Archivo a reemplazar
```
src/components/modules/importar.tsx
```
(Un solo archivo — copiar sobre el existente en el repo local)

## Pasos
1. Descargar y descomprimir este ZIP
2. Copiar `src/components/modules/importar.tsx` sobre el del repo local:
   ```
   C:\Users\usuario\OneDrive\Documentos\GitHub\viza-home-sistema\caetutti-protocol\src\components\modules\importar.tsx
   ```
3. GitHub Desktop → verás 1 archivo modificado
4. Commit message: `fix: import Excel agrupa filas en estructura clientes/cuotas`
5. **Commit to main** → **Push origin**
6. Esperar 2-3 min a que Vercel redeploye
7. Probar importar el Excel de 1556 filas en https://caetutti-protocol.vercel.app
8. El resultado debería mostrar ~700-800 clientes nuevos y ~1500 cuotas procesadas
   (dependiendo de cuántas cuotas tenga cada cliente en tu Excel)
