# FIX NOTIFICACIONES V4 — Mostrar TODOS los clientes

## Problema
En la pestaña Notificaciones aparecía:
```
Mostrando 100 de 543 — usa el buscador para filtrar
```
Solo se veían los primeros 100 clientes de los 543 totales.

## Causa
El frontend tenía `.slice(0, 100)` en 2 lugares:
- Lista de titulares
- Lista de codeudores

## Solución
- ❌ Eliminé `slice(0, 100)` de la lista de titulares
- ❌ Eliminé `slice(0, 100)` de la lista de codeudores
- ✅ Mensaje inferior actualizado: "Total: 543 cliente(s)" (sin límite)

## Archivo a reemplazar
```
src/components/modules/notificaciones.tsx
```

## Pasos

1. Descargar y descomprimir este ZIP
2. Copiar `src/components/modules/notificaciones.tsx` sobre el del repo local:
   ```
   C:\Users\usuario\OneDrive\Documentos\GitHub\viza-home-sistema\caetutti-protocol\src\components\modules\notificaciones.tsx
   ```
3. GitHub Desktop → verás 1 archivo modificado
4. Commit message: `fix: mostrar todos los clientes en notificaciones (sin límite de 100)`
5. **Commit to main** → **Push origin**
6. Esperar 2-3 min a que Vercel redeploye
7. Probar en https://caetutti-protocol.vercel.app → Notificaciones

## Resultado esperado
- Se ven TODOS los clientes (los 543, no solo 100)
- El mensaje inferior ahora dice: `Total: 543 cliente(s)`
- En la pestaña Codeudores dice: `Total: X cliente(s) · Y codeudor(es)`
- Todo lo demás queda igual (pestañas, codeudores, edición, etc.)
