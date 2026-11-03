# 🚀 Caetutti Protocol

Sistema de cobranzas con WhatsApp, IA y automatización.

## ✅ YA CONFIGURADO PARA:

* Base de datos: Neon (PostgreSQL) ✅
* Deploy: Vercel ✅
* Repo: GitHub ✅

## 🎯 INSTRUCCIONES RÁPIDAS

```cmd
npm install
npx prisma generate
npx prisma db push
npx tsx scripts/seed.ts
npm run dev
```

Abrir: http://localhost:3000

* Usuario: admin
* Contraseña: admin123

## 📤 SUBIR A GITHUB

```cmd
git init
git add .
git commit -m "Caetutti Protocol"
git remote add origin https://github.com/miceluttigabriel-design/caetutti-protocol.git
git branch -M main
git push -u origin main
```

## 🚀 DEPLOY EN VERCEL

1. https://vercel.com/ → Log In con GitHub
2. Add New Project → caetutti-protocol
3. Environment Variables:

   * DATABASE\_URL = (tu URL de Neon)
   * NEXTAUTH\_URL = https://caetutti-protocol.vercel.app
   * NEXTAUTH\_SECRET = caetutti-micelutti-2026-clave-super-secreta-cambiar-xyz
4. Deploy

Deploy inicial

