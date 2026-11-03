# FIX CODEUDORES APARTE — Caetutti Protocol

## Qué se pidió
> "en la parte de notificaciones quiero que ponga una opcion ahi de coodeudor para cobrar apenas el coodeudor amigo asi gestionamos los coodeudores aparte amigo de los titulares entonces no vá hacer falta mas agregar el coodeudor abajo del cliente en notificaciones"

## Cambios realizados (con mucho cuidado, solo lo que se pidió)

### 1. Agregué pestañas en el toolbar de Notificaciones
Dos botones arriba a la izquierda:
- **Titulares** (verde/primary) — lista de clientes como siempre, SIN la fila de codeudor debajo
- **Codeudores** (violeta) — nueva pestaña que lista solo codeudores para gestionarlos aparte

### 2. Eliminé la fila "Codeudor debajo del titular" en NotifCard
En la pestaña **Titulares** ya NO aparece:
- ❌ La fila violeta con el codeudor debajo del titular
- ❌ El botón "Registrar Codeudor" cuando no tenía codeudor
- ❌ La función `abrirWhatsappCodeudor` dentro de NotifCard (ya sin uso)

La tarjeta del titular ahora termina con:
- Datos del cliente + botones Ver / Editar / Cliente
- Modal editar montos (sin cambios)
- **GarantesSection** (múltiples garantes — SIN cambios, sigue funcionando igual)

### 3. Nuevo componente `CodeudorCard` para la pestaña "Codeudores"
Cada tarjeta muestra:
- 👤 Avatar violeta + nombre del codeudor
- 📞 Teléfono (o "Sin teléfono")
- 🔗 Titular asociado: `#codigoEntidad + nombre`
- 💰 Total a cobrar (heredado del titular, con interés si aplica)
- Botones:
  - **Ver** — abre el detalle con preview del mensaje
  - **Notificar** — abre WhatsApp con mensaje pre-cargado para el codeudor
    - Usa `esCodeudorGarante: true` para NO marcar las cuotas del titular como notificadas
  - **Editar** — abre el `CodeudorDialog` existente (sin cambios)

### Lo que NO se tocó (para no romper nada)
- ✅ GarantesSection (múltiples garantes) — funciona igual
- ✅ GaranteEditInline — funciona igual
- ✅ CodeudorDialog (registrar/editar/eliminar codeudor) — funciona igual
- ✅ NotifDetalle (ver detalle con preview) — funciona igual
- ✅ EditMontoDialog (editar saldos e intereses) — funciona igual
- ✅ Stats (Total, Sin teléfono, Con codeudor, Total a cobrar) — sin cambios
- ✅ Buscador — sigue buscando por cliente, teléfono o codeudor
- ✅ Switch "Ocultar notificados" — sin cambios

## Archivo a reemplazar
```
src/components/modules/notificaciones.tsx
```
(Un solo archivo — copiar sobre el existente en el repo local)

## Pasos
1. Descargar y descomprimir este ZIP
2. Copiar `src/components/modules/notificaciones.tsx` sobre el del repo local:
   ```
   C:\Users\usuario\OneDrive\Documentos\GitHub\viza-home-sistema\caetutti-protocol\src\components\modules\notificaciones.tsx
   ```
3. GitHub Desktop → verás 1 archivo modificado
4. Commit message: `feat: pestaña Codeudores aparte en Notificaciones`
5. **Commit to main** → **Push origin**
6. Esperar 2-3 min a que Vercel redeploye
7. Probar en https://caetutti-protocol.vercel.app → módulo Notificaciones

## Cómo usar la nueva UI
1. Abrir **Notificaciones**
2. Verás dos pestañas arriba a la izquierda: `Titulares` y `Codeudores`
3. **Titulares**: lista limpia de clientes, sin codeudor debajo (solo garantes siguen abajo)
4. **Codeudores**: lista de todos los codeudores registrados, cada uno con:
   - Su teléfono y datos
   - El titular al que está asociado
   - Botones para Ver / Notificar / Editar
5. Para agregar o editar un codeudor, vas a la pestaña "Codeudores" → botón "Editar" de cualquier codeudor existente → abre el dialog donde podés agregar/editar/eliminar
