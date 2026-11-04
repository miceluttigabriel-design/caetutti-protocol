# 🎯 FIX: Persistencia al importar + Reporte Exclusiones INFORCONF

## ⭐ Qué se arregló (con cuidado de no perder datos)

### 1. Teléfonos, codeudores e INFORCONF persisten al re-importar

**Antes**: cada vez que importabas el Excel, los campos se sobrescribían. Si el
Excel traía teléfono vacío o INFORCONF="N", **se borraba** el teléfono editado
manualmente y se perdía la marca INFORCONF.

**Ahora**:
- **Teléfono / Teléfono alternativo**: solo se sobrescriben si el Excel los trae
  con un valor real (no vacío). Si el Excel los trae vacíos, **se conserva** lo
  que ya estaba guardado.
- **INFORCONF / Judicial**: solo se marcan "S" si el Excel los trae como "S".
  Si el Excel los trae como "N" o vacío, **NO se sobrescribe** → preserva la
  marca manual que hiciste en el sistema.
- **Codeudores** (codeudorNombre, codeudorTelefono, etc.): no se tocan al
  importar (ya venían así, confirmado).
- **Saldo, fechaVcto, etc.**: estos SÍ se actualizan con cada importación (es
  la info financiera que cambia).

Resultado: si editás un teléfono o marcás INFORCONF="S" en el sistema, **queda
guardado** aunque re-importes el Excel.

### 2. Codeudores en Notificaciones siguen figurando igual
No se modificó la API de notificaciones — los codeudores siguen apareciendo
igual que antes. Solo se actualiza el saldo conforme a la importación.

### 3. Reporte de Exclusiones de Morosidades INFORCONF

Nuevo panel amarillo **abajo del titular** en la pestaña Clientes (arriba de la
tabla) que muestra:
- **Titulares con INFORCONF="S" sin deuda activa** (la deuda fue paga o no vino
  en el Excel)
- **Codeudores de titulares marcados INFORCONF="S"** (para que también les
  saques el flag)

Botón **"Exportar PDF / Imprimir"** que abre un reporte limpio con:
- Encabezado "⚠ EXCLUSIONES DE MOROSIDADES — INFORCONF"
- Resumen con totales
- Tabla de titulares (#, Código, Cliente, CI, Teléfono, Localidad, Sucursal,
  Vendedor, Judicial, Últ. Notif.)
- Tabla de codeudores (#, Cód. Titular, Titular, Codeudor, Teléfono, CI
  Codeudor, Parentesco, Sucursal, Titular sin deuda)
- Diálogo de impresión automático → podés **Guardar como PDF** o **Imprimir**

---

## 📦 Archivos incluidos (3)

| Archivo | Qué cambia |
|---|---|
| `src/app/api/import/route.ts` | ⭐ NO sobrescribe telefono/informconf/judicial con valores vacíos del Excel |
| `src/app/api/inforconf/exclusiones/route.ts` | ⭐ NUEVO: reporte de exclusiones (titulares + codeudores) |
| `src/components/modules/clientes.tsx` | ⭐ Panel amarillo con botón Exportar PDF |

## 🔧 Cómo aplicar

1. Abrí la carpeta del repo: `C:\Users\usuario\OneDrive\Documentos\GitHub\viza-home-sistema\caetutti-protocol`
2. Copiá la carpeta `src` de este ZIP y **reemplazá** la existente (sobrescribe 2 archivos + agrega 1 nuevo)
3. GitHub Desktop → commit (ej: "persistencia al importar + reporte exclusiones") → **Push**
4. Esperá 2-3 min el redeploy de Vercel

## ⚠️ No hace falta ejecutar nada en consola
Este fix no requiere comandos fetch. Funciona automáticamente después del deploy.

## 🧪 Después probá

### Persistencia:
1. Editá el teléfono de un titular en **Clientes** (botón Editar)
2. Marcá INFORCONF="S" en algún cliente
3. Re-importá el Excel (desde **Configuración → Importar Datos**)
4. Volvé a **Clientes** → el teléfono editado y el INFORCONF="S" siguen ahí ✓

### Reporte exclusiones:
1. Andá a **Clientes**
2. Si hay clientes con INFORCONF="S" sin deuda, vas a ver el panel amarillo arriba:
   > "⚠ Exclusiones INFORCONF: X titular(es) + Y codeudor(es)"
3. Apretá **"Exportar PDF / Imprimir"** → se abre el reporte → elegís Guardar como PDF o Imprimir

## 📝 Nota importante
- Los codeudores en Notificaciones **siguen figurando igual** que antes (no se tocó esa API)
- Solo se actualiza el saldo y la fechaVcto cuando re-importás (eso es lo que cambia del Excel)
- Los INFORCONF="S" sin deuda aparecen en el reporte para que puedas quitarles el flag manualmente

✅ TypeScript: 0 errores en los 3 archivos.
