# 🎯 FIX ACUMULATIVO: Reglas de Mensaje por Mora + Sin Interés + Timezone + WhatsApp

## ⭐ NUEVO en esta versión: Reglas de mensaje por rango de días (mora)

### Qué hace
Crea las **12 reglas de pie** (6 para titular + 6 para codeudor) con el enfoque
que pediste: **el cliente debe consultar el interés por mora con su gestor en
línea** — no mencionamos monto de interés porque no cuadra con el Excel.

### Escalado de tono (titular y codeudor, mismo rango):
| Rango | Tono | Mensaje clave |
|---|---|---|
| 0-7 días | Amable | "Verifique el valor de su interés por mora… consulte con su gestor en línea" |
| 8-30 días | Cordial | "El interés por mora se calcula por día… verifique con su gestor" |
| 31-60 días | Firme | "El interés sigue acumulándose… no incluya monto estimado, verifique con su gestor" |
| 61-90 días | Estricto | "Último aviso… verifique interés mora y abone hoy mismo" |
| 91-180 días | Severo | "AVISO FINAL… verifique interés mora para frenar el proceso legal" |
| 181+ días | Judicial | "NOTIFICACIÓN LEGAL… verifique interés mora para evitar demanda" |

### Ejemplo completo (caso FLEITAS, 3 días de atraso):
```
Estimado/a FLEITAS FONCESA, ADILSON, le informamos que tiene
cuotas pendientes por un total de ₲ 241.208.

- Vence: 01/11/2026 · Saldo: ₲ 241.208 · Vencido hace 3 días

Le recordamos amablemente que su cuota está próxima a vencer o recientemente vencida.

Este es su saldo pendiente de pago. Verifique el valor de su interés por mora
para poder abonar su cuenta. Consulte ahora mismo con su gestor en línea.

Atentamente,
Dpto. de Cobranzas — Casa Central
VIZA HOME
```

---

## ⚠️ PASOS IMPORTANTES después del deploy

Ejecutá estos **2 comandos** en la consola del navegador (F12 → "allow pasting" → pegar):

**1) Actualizar los templates con el nuevo pie por defecto:**
```js
fetch('/api/admin/reset-mensajes', { method: 'POST' }).then(r => r.json()).then(console.log)
```

**2) Crear las 12 reglas de pie (6 titular + 6 codeudor) con enfoque mora:**
```js
fetch('/api/admin/seed-pie-mora', {
  method: 'POST',
  headers: {'Content-Type':'application/json'},
  body: '{}'
}).then(r => r.json()).then(console.log)
```

Después de esto, los mensajes WhatsApp ya se generarán automáticamente con el
pie correcto según los días de atraso de cada cliente. Lo podés verificar en
**Configuración → Reglas de Notificación**.

---

## ✅ También incluye (acumulativo, todo en un ZIP)

1. **⭐ Reglas por mora**: 12 reglas (titular + codeudor) por rango de días
2. **⭐ Sin interés**: solo saldo del Excel + días vencidos (no se muestra interés)
3. **Fix timezone**: Vcto y días de atraso correctos (FLEITAS: 01/11, 3d)
4. **WhatsApp directo**: botón Cliente/Codeudor abre wa.me sin bloqueo
5. **Vencidos fuera de POR VENCER**: con cuota vencida → bloque VENCIDOS
6. **Sucursal GLOBAL para Clientes**: sin selector interno
7. **Panel 🤖 Automatización** dentro de Notificaciones
8. **🗑️ Zona Peligrosa** en pestaña General
9. **Pestaña Automatización ELIMINADA** de Configuraciones

---

## 📁 Archivos incluidos (10)

| Archivo | Qué cambia |
|---|---|
| `src/app/api/admin/seed-pie-mora/route.ts` | ⭐ NUEVO: crea las 12 reglas con enfoque mora |
| `src/app/api/admin/reset-mensajes/route.ts` | NUEVO (de la versión anterior): actualiza templates |
| `src/lib/mensajes.ts` | Saldo sin interés + nuevo pie + fechas UTC |
| `src/app/api/notificaciones/route.ts` | saldoTotalGs=saldoGs, interesGs=0 + criterio vencidos + días UTC |
| `src/components/modules/notificaciones.tsx` | Sin "+interés" en UI + WhatsApp directo + Vcto correcto + días UTC |
| `src/lib/format/index.ts` | `fmtDate` usa UTC (fix 31/10 → 01/11) |
| `src/app/api/import/route.ts` | `parseFecha` Excel serial → fecha local |
| `src/components/modules/clientes.tsx` | Vence: usa `fmtDate` + sin selector interno |
| `src/components/dashboard/shell.tsx` | Le pasa la sucursal global a Clientes |
| `src/components/modules/configuracion.tsx` | Sin pestaña Automatización · Zona Peligrosa en General |

## 🔧 Cómo aplicar

1. Abrí la carpeta del repo: `C:\Users\usuario\OneDrive\Documentos\GitHub\viza-home-sistema\caetutti-protocol`
2. Copiá la carpeta `src` de este ZIP y **reemplazá** la existente (sobrescribe los 10 archivos).
3. GitHub Desktop → commit (ej: "reglas mora titular + codeudor") → **Push**.
4. Esperá 2-3 min el redeploy de Vercel.
5. **Después del deploy, ejecutá los 2 comandos fetch** (arriba) en la consola del navegador.

✅ TypeScript: 0 errores en los 10 archivos.
