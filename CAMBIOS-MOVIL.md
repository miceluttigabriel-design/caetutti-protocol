# Mejoras para teléfono (v2)

La app mantiene exactamente el mismo diseño y funciones. Solo se mejoró la experiencia en celular.

## Rendimiento
- `next.config.ts`: el header "no-store" ya NO se aplica a `/_next/static`, imágenes e iconos.
  Antes el celular re-descargaba todo el JS en cada apertura. Páginas y API siguen sin caché.
- `public/sw.js` (v2): todo `/_next/static` se guarda en caché (cache-first) con límite de entradas.
- CSS: se apaga el parpadeo en móvil, se respeta "reducir movimiento" y se suaviza el viñeteado.

## Navegación
- Botón **atrás** del celular vuelve a la sección anterior (antes salía de la app).
- Atajos del icono instalado (`/?page=...`): Notificaciones, Clientes, Deudas y Chats.
- Al cambiar de sección vuelve al inicio de la pantalla.
- Menú **Más**: ahora se cierra al elegir una sección (antes quedaba abierto) y se resalta si estás en una de esas secciones.

## Pantallas
- **Clientes, Deudas, Historial**: en celular se muestran como tarjetas (sin scroll horizontal), con botones de 40px
  y teléfono tocable (llamar). En tablet/PC siguen las tablas de siempre.
- **Comunicaciones**: patrón WhatsApp (lista → conversación) con botón "Conversaciones" para volver,
  autoscroll al último mensaje, burbujas más anchas, mensajes copiables y teclado con tecla "Enviar".
- **Notificaciones**: tarjeta reorganizada (datos + monto arriba, 3 botones grandes abajo); codeudor y garantes con botones táctiles.
- **Diálogos**: en celular se abren desde abajo como hoja (bottom-sheet), respetan la barra de gestos y el botón cerrar es más grande.
- **Login**: teclado sin autocapitalizar usuario.
- Alturas con `dvh` (ya no se corta contenido por la barra del navegador móvil).
- Avisos (toasts) respetan el notch.

## Corrección menor
- `ClientesModule` ahora declara la prop `sucursal` (daba un error de tipos silenciado).

## Archivos modificados
next.config.ts · public/manifest.json · public/sw.js · src/app/globals.css · src/app/page.tsx ·
src/components/providers.tsx · src/components/auth/login-screen.tsx · src/components/ui/dialog.tsx ·
src/components/dashboard/{shell,mobile-nav,sidebar}.tsx ·
src/components/modules/{clientes,cuotas,historial,comunicaciones,notificaciones}.tsx
