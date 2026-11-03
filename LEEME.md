# FIX USUARIOS DEMO — Caetutti Protocol

## 2 cambios

### 1️⃣ Pantalla de login: solo botón Admin
**Antes:** 3 botones demo (admin, cobrador, vendedor)
**Ahora:** 1 solo botón (admin)
- Título cambiado: "DEMO ACCOUNTS" → "ADMIN ACCESS"
- Placeholder del campo usuario: "admin, cobrador, vendedor…" → "admin"

### 2️⃣ Eliminar usuarios demo de la base de datos
Elimina de la DB los usuarios:
- **Juan Cobrador** (cobrador / cobrador123)
- **Ana Vendedora** (vendedor / vendedor123)

Solo queda el usuario **admin**.

---

## Archivos

### 1. `src/components/auth/login-screen.tsx` (REEMPLAZAR)
Login actualizado con solo el botón de admin.

### 2. `src/app/api/admin/limpiar-usuarios-demo/route.ts` (NUEVO)
Endpoint para eliminar los usuarios demo:
- `GET` → lista los usuarios demo encontrados (sin eliminar)
- `POST { confirmar: true }` → elimina cobrador y vendedor
- Antes de eliminar el usuario, borra sus registros relacionados (notificaciones enviadas, contactos del día) para evitar errores de foreign key

---

## Pasos para aplicar

### 1️⃣ Descargá y descomprimí este ZIP

### 2️⃣ Copiar los 2 archivos a tu repo local

**Archivo 1 (reemplazar existente):**
```
src/components/auth/login-screen.tsx
→ ...caetutti-protocol\src\components\auth\login-screen.tsx
```

**Archivo 2 (crear carpeta nueva + archivo):**
```
src/app/api/admin/limpiar-usuarios-demo/route.ts
→ ...caetutti-protocol\src\app\api\admin\limpiar-usuarios-demo\route.ts
```

### 3️⃣ GitHub Desktop — verás 2 archivos:
- `src/components/auth/login-screen.tsx` (modificado)
- `src/app/api/admin/limpiar-usuarios-demo/route.ts` (nuevo)

### 4️⃣ Commit + Push:
- Mensaje: `feat: login solo admin + endpoint eliminar usuarios demo`
- **Commit to main** → **Push origin**

### 5️⃣ Esperá 2-3 min a que Vercel redeploye

---

## 🗑️ Eliminar los usuarios demo (después del deploy)

1. Entrá a https://caetutti-protocol.vercel.app (logueate como admin/admin123)
2. Abrí la consola del navegador (**F12** → pestaña **Console**). Si sale el warning amarillo, escribí `allow pasting` y dale Enter.
3. Primero, previsualizá qué usuarios demo hay (opcional):

```javascript
fetch('/api/admin/limpiar-usuarios-demo')
.then(r => r.json())
.then(data => console.log('📋 Usuarios demo:', data))
.catch(e => console.error('❌ Error:', e));
```

Vas a ver:
```
📋 Usuarios demo: {
  usuariosDemoEncontrados: 2,
  usuariosDemo: [
    { login: "cobrador", nombre: "Juan Cobrador", rol: "cobrador", ... },
    { login: "vendedor", nombre: "Ana Vendedora", rol: "vendedor", ... }
  ],
  usuariosTotales: [...]
}
```

4. Ahora ejecutá la eliminación:

```javascript
fetch('/api/admin/limpiar-usuarios-demo', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ confirmar: true })
})
.then(r => r.json())
.then(data => console.log('✅ Eliminados:', data))
.catch(e => console.error('❌ Error:', e));
```

Vas a ver:
```
✅ Eliminados: {
  mensaje: "Limpieza de usuarios demo completada",
  eliminados: [
    { login: "cobrador", nombre: "Juan Cobrador", eliminado: true },
    { login: "vendedor", nombre: "Ana Vendedora", eliminado: true }
  ],
  usuariosRestantes: [
    { login: "admin", nombre: "Administrador Demo", rol: "admin", activo: true }
  ]
}
```

5. Listo — solo queda el usuario admin en el sistema.

---

## ✅ Verificación final

1. **Login**: refrescá la página (F5) → el login solo muestra el botón "admin"
2. **Usuarios**: andá al módulo de administración de usuarios → solo debe aparecer "Administrador Demo"
3. **Login cobrador/vendedor**: si intentás loguearte con cobrador/vendedor → debe dar error de credenciales (ya no existen)

---

## 🛡️ Seguridad

- El endpoint requiere sesión de **admin** (cobradores/vendedores no pueden ejecutarlo)
- Requiere `{ confirmar: true }` explícito para ejecutar la eliminación
- Elimina primero los registros relacionados (notificaciones, contactos) para evitar errores de integridad
