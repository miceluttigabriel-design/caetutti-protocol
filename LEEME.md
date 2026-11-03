# 🤝 Codeudor como entidad + Filtro por sucursal en Clientes

## ¿Qué cambia este patch?

### 1) ❌ Quitar botón "Nuevo Cliente" de la pestaña Clientes
- Ya no vas a ver el botón **+ Nuevo Cliente** arriba a la derecha en Clientes.
- Los clientes se crean de dos formas: por **importación de Excel** (los titulares) y **automáticamente al registrar un codeudor** desde Notificaciones.
- La edición de cliente (lápiz) sigue funcionando igual.

### 2) 🤝 Codeudor se registra como entidad Cliente automáticamente
- Cuando registrás un codeudor en **Notificaciones → Codeudores → Registrar Codeudor**,
  además de guardar los datos en el titular, **se crea un nuevo registro en la tabla Cliente**
  con `codigoEntidad = "GAR-{codigoTitular}"` (ej: si el titular es `001234`, el codeudor queda como `GAR-001234`).
- El codeudor hereda la sucursal, vendedor y cobrador del titular.
- Vas a verlo en la pestaña **Clientes** como una entidad más.
- Si ya existe un codeudor con ese código (porque lo registraste antes), se **actualizan** sus datos.
- Si eliminás el codeudor desde el titular, también se elimina la entidad creada.

### 3) 🏢 Filtro por sucursal en la pestaña Clientes
- Arriba, al lado del buscador, ahora hay un selector **"Todas las sucursales"**.
- Al elegir una sucursal, la tabla, las tarjetas de estadísticas y el paginador se recalculan
  sobre los clientes de esa sucursal.
- Elegí "Todas las sucursales" para ver todo igual que antes.

---

## 📦 Instalación (igual que siempre)

1. Descomprimí `fix-codeudor-sucursal.zip`
2. Copiá las carpetas `src/` dentro de la raíz del repo
   `C:\Users\usuario\OneDrive\Documentos\GitHub\viza-home-sistema\caetutti-protocol`
   (se reemplazan 2 archivos)
3. En GitHub Desktop → commit (ej: "🤝 Codeudor como entidad + filtro sucursal") → **Push origin**
4. Esperá 2–3 minutos al redeploy de Vercel

## ✅ Cómo probar

### Codeudor → entidad:
1. Andá a **Notificaciones → pestaña Codeudores → Registrar Codeudor**
2. Buscá un titular, completá nombre/teléfono/CI/parentesco → **💾 Registrar Codeudor**
3. Andá a **Clientes** y buscá por el nombre del codeudor (o por `GAR-` para ver todos)
4. Debería aparecer como entidad propia con su teléfono, su sucursal, etc.

### Filtro por sucursal:
1. En **Clientes**, abrí el selector de sucursales (arriba, a la derecha del buscador)
2. Elegí una sucursal → la tabla muestra solo los clientes de esa sucursal
3. Las tarjetas de Total / Con teléfono / Sin teléfono / Judicial se recalculan sobre esa sucursal
4. Volvé a "Todas las sucursales" para ver todo

### Botón Nuevo Cliente eliminado:
- En **Clientes** ya NO debe aparecer el botón verde **+ Nuevo Cliente**.
- Solo quedan el buscador + el selector de sucursal + indicador "actualizando…".

## 🔧 Detalle técnico (por si te interesa)

El nuevo flujo del endpoint `PUT /api/clientes/[id]/codeudor`:
1. Guarda los campos `codeudorNombre`, `codeudorTelefono`, `codeudorCi`, `codeudorParentesco`
   en el titular (compatibilidad hacia atrás con Notificaciones).
2. Calcula `codigoCodeudor = "GAR-" + codigoEntidadTitular`.
3. Busca si ya existe un `Cliente` con ese código:
   - Si existe → actualiza nombre, teléfono, CI, sucursal, vendedor, cobrador.
   - Si no existe → lo crea con esos datos y el mismo `empresaId` que el titular.
4. Si algo falla en la creación de la entidad (no debería), no rompe el flujo:
   el codeudor ya quedó guardado en los campos del titular.

El `DELETE /api/clientes/[id]/codeudor` también elimina la entidad creada (si existe).
