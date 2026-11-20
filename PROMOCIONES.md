# 📣 Promociones por WhatsApp — Reimpex Motos

Módulo nuevo, **aparte de la cobranza**. La cobranza sigue igual que siempre
(clientes, cuotas, deudas, notificaciones). Esto agrega una sola cosa:

> Subís un Excel de contactos → elegís un mensaje → mandás la promo por WhatsApp.

No toca clientes, no toca deudas, no crea cuotas. Es para **vender y promocionar**.

---

## 1. Lo que hay que hacer (una sola vez)

1. **GitHub Desktop** → commit → **Push origin**. Vercel despliega solo.
2. Cuando termine el deploy, abrí en el navegador:
   `https://TU-DOMINIO/api/admin/setup-promociones`
   Si responde `"Tablas de promociones listas"`, ya está.
   (Es la primera vez nomás; no borra nada.)
3. Menú **Promociones** → **Nueva campaña**.

> Alternativa: `npx prisma db push` con la `DATABASE_URL` de producción.
> Solo agrega dos tablas nuevas (`Promocion` y `PromocionContacto`).

Si tu usuario no es admin: Configuración → Grupos → activá
**Promociones / Ventas WhatsApp**.

---

## 2. Cómo tiene que ser el Excel

Una fila de encabezados y después los contactos. Ejemplo:

| Nombre | Telefono | Modelo | Localidad |
|---|---|---|---|
| Juan Benítez | 0981 123 456 | Kenton GT 150 | Ciudad del Este |
| María González | 0972 555 111 | Star SRL 150 | Presidente Franco |

- **Obligatorios:** nombre y teléfono.
- **Opcionales:** modelo, localidad, CI, notas.
- **Formatos:** `.xlsx`, `.xls` o `.csv`.
- El orden de las columnas no importa: el sistema reconoce los encabezados
  aunque digan “Cliente”, “Celular”, “WhatsApp”, “Moto”, “Ciudad”, etc.

> Dato: si subís el **mismo Excel de la cobranza**, también lo entiende
> (usa “Entidad” como nombre y “Telefono”). Nomás ignora saldos y vencimientos,
> y los clientes repetidos se cargan una sola vez.

Cosas que el sistema hace solo:
- Normaliza el teléfono (`0981...` → `595981...`).
- Saca **repetidos** para no mandarle dos veces al mismo número.
- Los que vienen sin teléfono quedan marcados como **“Sin teléfono”** y no se envían.

---

## 3. Las tres formas de enviar

### Manual (ZapFast / wa.me) — no gasta API
El sistema te muestra la lista. Tocás **Abrir en ZapFast** y pasa esto:

1. ZapFast abre (o viene al frente) en el chat de ese contacto.
2. El conector pega el mensaje personalizado y lo envía solo.

El contacto se marca como **Enviado** a los 8 segundos (le da tiempo a ZapFast
a pegar y mandar). Si no salió, tocá **Deshacer** en la lista y queda pendiente
otra vez.

Si en esa PC no tenés ZapFast, al lado está el botón **wa.me**, que abre
WhatsApp normal (Web, escritorio o celular) con el texto ya escrito y lo marca
como enviado al abrirlo.

Ideal para empezar o cuando son pocos.

### Copiar y pegar — para WhatsApp Web, el celular o ZapFast
Tocás **Copiar** en un contacto (o **Copiar el siguiente**) y el mensaje
personalizado queda en el portapapeles, listo para pegar donde quieras.
Al copiarlo, el contacto queda marcado como **Enviado**.

Es la opción que sirve si usás **ZapFast** u otro cliente de WhatsApp de
escritorio: copiás acá y pegás allá. Ver la nota de ZapFast más abajo.

### Automático (API) — manda el sistema solo
Usa el mismo WhatsApp conectado de la cobranza (Configuración → WhatsApp).
Tocás **Enviar a N pendientes** y va mandando en tandas, mostrando el progreso.
Podés **Detener** cuando quieras y retomar después: los enviados no se repiten.

> Si Meta rechaza un mensaje por estar fuera de la ventana de 24 h, probá con
> el modo manual para esos contactos. Los errores quedan en la pestaña
> **Problemas** con el motivo, y se pueden reintentar.

> Ojo con el costo: cada mensaje enviado por la API descuenta del límite
> mensual configurado en Configuración → WhatsApp (por defecto US$ 50).
> Si vas a mandar cientos, subí ese límite o usá el modo manual.

### Nota sobre ZapFast (github.com/crmne/zapfast)

ZapFast es una **app de escritorio** (Windows, macOS, Linux) para leer y
responder WhatsApp con una cuenta propia. No es un servidor ni manda mensajes
en masa: no tiene API pública ni bots.

Lo que **sí** hace, y ya está conectado en el sistema:

- Acepta que se le pase un número y **abre el chat de esa persona**, trayendo su
  ventana al frente.
- El botón **“Abrir en ZapFast”** le pasa también el mensaje. Un conector chico
  instalado en la PC abre el chat, **espera a que ZapFast termine de cargar**,
  clickea el cuadro de mensaje usando su posición real, pega (`Ctrl+V`) y envía
  (`Enter`) solo. Vos tocás una vez y el mensaje sale en ~3 segundos.
- La **imagen** no viaja sola en este modo: en la ficha de la campaña tenés
  **Descargar imagen** y la adjuntás en ZapFast (que sí permite pegar fotos).

#### Instalarlo una sola vez en cada PC

La primera vez, en cada computadora donde quieras usar ZapFast:

1. En la campaña, modo **Manual**, tocá **“ejecutá esto una sola vez”**.
2. Se descarga `instalar-zapfast.cmd`. Abrilo (doble clic).
3. Windows puede avisar que es un archivo descargado: **Más información →
   Ejecutar de todas formas**.
4. Listo. No pide administrador: todo queda en tu usuario.

El instalador descarga el conector `abrir-zapfast.ps1` y registra el enlace
`zapfast://`. La primera vez el navegador pregunta **“¿Abrir ZapFast?”**;
marcá que sí (podés dejar “recordar”). Después ya no pregunta más.

> Si ya habías instalado la versión anterior (la que solo abría el chat),
> **volvé a ejecutar el instalador nuevo**: es el que pega y envía solo.

> ZapFast es un cliente **no oficial**: WhatsApp puede sancionar la cuenta que lo
> usa. Para envío masivo real y sin tocar teclas, seguí usando el modo
> **Automático (API)** con el WhatsApp que ya está conectado a la cobranza.

---

## 4. El mensaje

Se escribe una vez y se personaliza por contacto con estas variables:

| Variable | Se reemplaza por |
|---|---|
| `{nombre}` | Nombre del contacto |
| `{modelo}` | Modelo de interés (si vino en el Excel) |
| `{localidad}` | Ciudad / barrio |
| `{ci}` | Cédula |

Ejemplo:

```
¡Hola {nombre}! 👋 Soy de Reimpex Motos.
Tenemos una promo en {modelo} con entrega desde ₲1.500.000
y cuotas que te van a gustar. ¿Te paso los detalles?
```

En la ficha de la campaña ves la **vista previa** con el primer contacto.

### Imagen de la promo (opcional)

En **Nueva campaña** (o en **Editar**) podés elegir una imagen: la foto de la
moto, el flyer, lo que quieras. Es opcional; si no ponés nada, va solo el texto.

- Formatos: **JPG, PNG o WebP**. La imagen se achica y se comprime sola en tu
  navegador antes de subirla (una foto de 5 MB queda en ~300 KB).
- En **Automático (API)** se manda como **foto con el mensaje al pie**. WhatsApp
  permite hasta **1024 caracteres** de pie de foto; si el mensaje es más largo
  se recorta ahí (el texto completo queda en la campaña).
- En **Manual** y **Copiar y pegar** el mensaje no lleva la foto: en la ficha de
  la campaña tenés **Descargar imagen** y la adjuntás vos en WhatsApp.
- Podés cambiarla o quitarla cuando quieras desde **Editar**.

---

## 5. Qué más podés hacer

- **Agregar contactos** a una campaña ya creada (subís otro Excel, no duplica).
- **Editar** nombre, mensaje y forma de envío en cualquier momento.
- **Filtrar** por pendientes / enviados / problemas, y buscar por nombre,
  teléfono o modelo. La lista viene de a 100 con botones **Anterior / Siguiente**.
- **Marcar como enviado** a mano (si mandaste por fuera) o **deshacer**.
- **Reintentar** los que dieron error.
- **Enviar** directo desde la tarjeta de la campaña: el botón **Enviar N** abre
  la campaña y arranca el envío automático.
- **Borrar** una campaña completa (borra sus contactos, nada más).

### Excel grande (100.000 filas)

Probado con `grid_cat_entidad.xlsx` (101.122 filas, 4,4 MB):

- Detecta **Nombre**, **Telefono** y toma **Documento** como CI.
- Carga **72.906 contactos únicos** con celular válido (el resto: ~21.000 sin
  teléfono, 8.142 que no son celulares y 6.941 repetidos, se saltean solos).
- El Excel se lee **en tu navegador** y se manda al servidor en tandas de 2.000
  contactos. Por eso no importa el peso del archivo ni el límite de Vercel.
- La ficha de la campaña **no** trae los 72.000 de golpe: pagina de a 100 con
  filtros y buscador del lado del servidor.

> Un Excel de 100.000 filas tarda un par de minutos. Dejá la ventana abierta:
> abajo ves “Cargando X de 72.906”. Si se corta a la mitad, volvé a subir el
> mismo archivo con **Agregar contactos**: no duplica a los que ya entraron.

---

## 6. Archivos nuevos

```
prisma/schema.prisma                              (+2 modelos)
src/lib/promociones.ts                            (mensajes, variables, teléfonos)
src/lib/promociones-excel.ts                      (lectura del Excel)
src/lib/promociones-db.ts                         (auto-provisión de tablas)
src/components/modules/promociones.tsx            (panel)
src/app/api/promociones/…                         (crear, listar, editar, borrar)
src/app/api/promociones/[id]/importar/route.ts    (agregar contactos)
src/app/api/promociones/[id]/enviar/route.ts      (envío por API)
src/app/api/promociones/[id]/imagen/route.ts      (subir / quitar imagen)
src/app/api/promociones/imagen/[token]/route.ts   (URL pública para WhatsApp)
src/lib/promociones-imagen.ts                     (compresión en el navegador)
public/zapfast/instalar-zapfast.cmd               (conecta ZapFast con el navegador)
public/zapfast/abrir-zapfast.ps1                  (pega y envía en ZapFast)
src/app/api/promociones/[id]/contactos/[contactoId]/route.ts (marcar manual)
src/app/api/admin/setup-promociones/route.ts      (preparar/verificar tablas)
```

También se tocaron `permisos.ts`, `shell.tsx`, `sidebar.tsx`, `mobile-nav.tsx`
y `topbar.tsx` para que **Promociones** aparezca en el menú.

---

## 7. Si algo no abre

1. Abrí `/api/admin/setup-promociones` y mirá qué responde.
2. Si es error de permisos, el usuario de `DATABASE_URL` necesita permiso
   de `CREATE` en el schema.
3. Último recurso: `npx prisma db push` apuntando a la base de producción.

### Si ZapFast abre pero no manda el mensaje

1. Si ZapFast muestra **“Loading older messages from your phone”**, esperá
   poquito: el conector espera 4 segundos y, si sigue cargando, reinicia ZapFast
   (vuelve a quedar listo en ~1 segundo) y recién entonces escribe.
2. Mirá el registro que deja el conector en esta PC:
   `C:\Users\usuario\AppData\Local\ZapFastAbrir\ultimo-intento.txt`
   - `ZapFast listo en Xs: cuadro 'Message'` y
     `pegado y Enter enviados` → salió.
   - `ZapFast estaba cargando: lo reinicio` → estaba colgado; ya lo reinició.
   - `portapapeles=False` → Windows no dejó usar el portapapeles; el conector
     escribe el texto tecla por tecla como respaldo.
   - `no pude enfocar el cuadro` o `perdi el foco despues de pegar` → no se
     mandó nada para no escribir en el chat equivocado; volvé a tocar.
   - `no es zapfast://` → volvé a ejecutar el instalador.
3. Si el texto aparece en el cuadro pero no se envía, revisá en la
   configuración de ZapFast que **Enter envíe el mensaje**.
4. Si no aparece nada, cerrá ZapFast del todo (icono de la bandeja →
   **Quit**) y abrilo otra vez: a veces queda a medias la conexión con el
   teléfono.
5. Si en esa PC nunca instalaste el conector, en la campaña tocá
   **“ejecutá esto una sola vez”** y volvé a probar.
