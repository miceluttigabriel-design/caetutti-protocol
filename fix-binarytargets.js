#!/usr/bin/env node
/**
 * FIX BINARYTARGETS — Caetutti Protocol
 * Elimina la propiedad `binaryTargets` del schema.prisma
 * porque Prisma 6.x ya no la soporta (causa P1012).
 *
 * Uso:  node fix-binarytargets.js
 * Ejecutar desde la RAÍZ del repositorio caetutti-protocol
 */

const fs = require("fs");
const path = require("path");

const SCHEMA_PATH = path.join(process.cwd(), "prisma", "schema.prisma");

if (!fs.existsSync(SCHEMA_PATH)) {
  console.error("❌ No se encontró prisma/schema.prisma en:", SCHEMA_PATH);
  console.error("   Ejecutá este script desde la raíz del repositorio caetutti-protocol.");
  process.exit(1);
}

let schema = fs.readFileSync(SCHEMA_PATH, "utf8");
console.log("📄 Leyendo prisma/schema.prisma...\n");

const original = schema;

// Eliminar la línea binaryTargets (con cualquier variación de espacios/comentarios)
schema = schema.replace(
  /^\s*binaryTargets\s*=[^\n]*\n/gm,
  ""
);

if (schema === original) {
  console.log("ℹ️  No se encontró la línea `binaryTargets` en el schema.");
  console.log("   Tal vez ya fue eliminada. Revisá el archivo manualmente.");
  process.exit(0);
}

fs.writeFileSync(SCHEMA_PATH, schema, "utf8");

console.log("✅ Eliminada la línea `binaryTargets` del schema.prisma");
console.log("\n📄 Bloque datasource ahora debería verse así:\n");
console.log("  datasource db {");
console.log('    provider  = "postgresql"');
console.log('    url       = env("DATABASE_URL")');
console.log('    directUrl = env("DATABASE_URL")');
console.log("  }");
console.log("\n" + "═".repeat(60));
console.log("  PRÓXIMOS PASOS");
console.log("═".repeat(60));
console.log(`
1. Abrí GitHub Desktop — vas a ver 1 archivo modificado:
   - prisma/schema.prisma

2. Commit message: "fix: remove binaryTargets (no soportado en Prisma 6)"

3. Commit to main  →  Push origin

4. Vercel redeploya automáticamente (2-3 min).

5. Probá login: https://caetutti-protocol.vercel.app
   Usuario: admin  |  Contraseña: admin123
`);
