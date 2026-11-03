# FIX SCHEMA PRISMA — Caetutti Protocol

## Problema
El login en Vercel falla con:
```
Prisma database validation error
datasource `db` URL must start with `file:`
schema.prisma line 10, provider = "sqlite"
```

**Causa:** `prisma/schema.prisma` tiene `provider = "sqlite"` pero la
base de datos es Neon PostgreSQL. Prisma espera una URL `file:` y rechaza
la URL `postgresql://` de Neon.

## Solución (automática)

1. Copiá `fix-schema.js` a la **raíz** de tu repositorio local
   `caetutti-protocol` (junto a `package.json`).

2. Abrí una terminal / PowerShell en esa carpeta y ejecutá:

```
node fix-schema.js
```

3. El script va a:
   - Cambiar `provider = "sqlite"` → `provider = "postgresql"` en `prisma/schema.prisma`
   - Agregar `directUrl` y `binaryTargets` (necesario para Vercel)
   - Agregar `"postinstall": "prisma generate"` a `package.json`

4. Abrí **GitHub Desktop**, vas a ver 2 archivos modificados:
   - `prisma/schema.prisma`
   - `package.json`

5. Commit message: `fix: schema provider postgresql + binaryTargets`

6. **Commit to main** → **Push origin**

7. Vercel redeploya automáticamente (2-3 minutos).

8. Probá login: https://caetutti-protocol.vercel.app
   Usuario: `admin`  Contraseña: `admin123`

---

## Solución (manual) — si preferís editar a mano

### Archivo 1: `prisma/schema.prisma`

Buscar el bloque datasource (arriba de todo) y dejarlo así:

```prisma
datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  directUrl  = env("DATABASE_URL")
  binaryTargets = ["native", "linux-x64-openssl-1.1.x"]
}
```

### Archivo 2: `package.json`

En la sección `"scripts"`, asegurate de tener:

```json
"postinstall": "prisma generate",
```

Quedaría algo así:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "postinstall": "prisma generate",
  "lint": "next lint"
}
```

Después commit + push por GitHub Desktop.
