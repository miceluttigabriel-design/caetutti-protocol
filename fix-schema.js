#!/usr/bin/env node
/**
 * FIX SCHEMA PRISMA — Caetutti Protocol
 * Corrige el problema de login en Vercel cambiando el provider de sqlite a postgresql
 *
 * Uso:  node fix-schema.js
 * Ejecutar desde la RAÍZ del repositorio caetutti-protocol
 */

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const SCHEMA_PATH = path.join(ROOT, "prisma", "schema.prisma");
const PKG_PATH = path.join(ROOT, "package.json");

let changes = [];

// ─── 1. Corregir schema.prisma ───────────────────────────────────
if (!fs.existsSync(SCHEMA_PATH)) {
  console.error("❌ No se encontró prisma/schema.prisma en:", SCHEMA_PATH);
  console.error("   Ejecutá este script desde la raíz del repositorio caetutti-protocol.");
  process.exit(1);
}

let schema = fs.readFileSync(SCHEMA_PATH, "utf8");
console.log("📄 Leyendo prisma/schema.prisma...");

// 1a. Cambiar provider de sqlite a postgresql
if (/provider\s*=\s*"sqlite"/i.test(schema)) {
  schema = schema.replace(/provider\s*=\s*"sqlite"/i, 'provider = "postgresql"');
  changes.push("✅ provider cambiado de \"sqlite\" a \"postgresql\"");
} else if (/provider\s*=\s*"postgresql"/i.test(schema)) {
  console.log("   ℹ️  provider ya era \"postgresql\" — sin cambios.");
} else {
  console.error("❌ No se encontró la línea `provider = \"sqlite\"` ni `provider = \"postgresql\"`.");
  console.error("   Revisá manualmente el bloque datasource en prisma/schema.prisma");
  process.exit(1);
}

// 1b. Asegurar binaryTargets y directUrl dentro del bloque datasource
// Buscar el bloque datasource db { ... }
const dsMatch = schema.match(/datasource\s+db\s*\{([^}]*)\}/s);
if (dsMatch) {
  let dsBlock = dsMatch[1];
  let dsModified = false;

  // Agregar directUrl si no existe
  if (!/directUrl\s*=/.test(dsBlock)) {
    dsBlock = dsBlock.replace(
      /(url\s*=\s*env\("DATABASE_URL"\))/,
      '$1\n  directUrl = env("DATABASE_URL")'
    );
    dsModified = true;
  }

  // Agregar binaryTargets si no existe
  if (!/binaryTargets\s*=/.test(dsBlock)) {
    dsBlock = dsBlock.trimEnd() + '\n  binaryTargets = ["native", "linux-x64-openssl-1.1.x"]';
    dsModified = true;
  }

  if (dsModified) {
    schema = schema.replace(
      /datasource\s+db\s*\{([^}]*)\}/s,
      "datasource db {" + dsBlock + "\n}"
    );
    changes.push("✅ Agregado directUrl y binaryTargets al bloque datasource");
  }
}

fs.writeFileSync(SCHEMA_PATH, schema, "utf8");
console.log("   ✏️  schema.prisma actualizado.\n");

// ─── 2. Corregir package.json (postinstall: prisma generate) ─────
if (fs.existsSync(PKG_PATH)) {
  console.log("📦 Leyendo package.json...");
  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, "utf8"));

  if (!pkg.scripts) pkg.scripts = {};

  if (!pkg.scripts.postinstall || pkg.scripts.postinstall !== "prisma generate") {
    pkg.scripts.postinstall = "prisma generate";
    fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + "\n", "utf8");
    changes.push("✅ Agregado \"postinstall\": \"prisma generate\" a package.json");
  } else {
    console.log("   ℹ️  postinstall ya estaba configurado — sin cambios.");
  }
} else {
  console.error("⚠️  No se encontró package.json — saltando verificación de postinstall.");
}

// ─── 3. Resumen ──────────────────────────────────────────────────
console.log("\n" + "═".repeat(60));
console.log("  RESUMEN DE CAMBIOS");
console.log("═".repeat(60));
if (changes.length === 0) {
  console.log("  Todo ya estaba correcto. No se hicieron cambios.");
} else {
  changes.forEach((c) => console.log("  " + c));
}
console.log("═".repeat(60));
console.log(`
📌 PRÓXIMOS PASOS:

1. Verificá los cambios abriendo prisma/schema.prisma — debe decir:
     provider = "postgresql"

2. Abrí GitHub Desktop, vas a ver los archivos modificados:
   - prisma/schema.prisma
   - package.json

3. Escribí un mensaje de commit:  "fix: schema provider postgresql + binaryTargets"

4. Commit to main  →  Push origin

5. Vercel va a redeployar automáticamente. Esperá 2-3 minutos.

6. Probá el login en https://caetutti-protocol.vercel.app
   con admin / admin123

✅ Si el login funciona, ¡listo!
❌ Si sigue fallando, mandame captura del NUEVO error.
`);
