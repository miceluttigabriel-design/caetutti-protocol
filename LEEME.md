# FIX PIE RULES — Caetutti Protocol

## Reglas tipo PIE para CLIENTE y CODEUDOR

Crea 12 reglas (6 para cliente + 6 para codeudor) con tono gradual según los días de atraso.

## Tono gradual por rango de días

| Días | Tonalidad | Para Cliente | Para Codeudor |
|------|-----------|--------------|---------------|
| 0-7 | Amable / preventivo | Recordatorio amable, próxima a vencer | Información preventiva, colaborar con titular |
| 8-30 | Cordial / recordatorio | Solicitud cordial de regularización | Solicitud cordial de colaborar |
| 31-60 | Firme / urgente | Insta a regularizar urgente, menciona interés | Recordatorio de responsabilidad solidaria |
| 61-90 | Estricto / último aviso | Último aviso, amenaza Informconf y legal | Aviso de cobro directo al codeudor |
| 91-180 | Severo / derivación legal | Aviso final, derivación legal en 48h | Aviso final, codeudor incluido en acciones |
| 181+ | Crítico / judicial | Notificación legal, demanda judicial | Notificación legal, demanda al codeudor |

## Firma en todos los mensajes

Todos los pies terminan con:
```
Dpto. de Cobranzas — Casa Central
VIZA HOME
```

(Los críticos 181+ firman como "Dpto. Legal — Casa Central / VIZA HOME")

## Variables disponibles en los pies

Las variables se reemplazan automáticamente al generar el mensaje:

- `{Entidad}` — Nombre del cliente (o codeudor en su caso)
- `{Codigo Entidad}` — Código del cliente
- `{Total Gs}` — Total a pagar formateado
- `{dias_absolutos}` — Días de atraso (sin signo, siempre positivo)
- `{dias_texto}` — Texto descriptivo: "vencido hace 30 días", "por vencer", etc.
- `{dias_estado}` — Estado legible: "Vencido", "Por vencer"
- `{Fecha Vcto}` — Fecha de vencimiento
- `{Saldo en Gs}` — Saldo formateado
- `{Sucursal}`, `{Vendedor}`, `{Localidad}` — Datos del cliente

## Archivos a agregar / reemplazar

### 1. `src/app/api/admin/seed-pie-rules/route.ts` (NUEVO)

Endpoint POST para crear las 12 reglas automáticamente:
- Borra las reglas pie existentes (si `sobreescribir: true`, default)
- Crea 6 reglas `pie_cliente` (rangos 0-7, 8-30, 31-60, 61-90, 91-180, 181+)
- Crea 6 reglas `pie_codeudor` (mismos rangos)
- Requiere permiso de admin

### 2. `src/lib/mensajes.ts` (REEMPLAZAR)

Cambio menor pero crucial:
- **Antes:** El pie dinámico se insertaba sin sustituir variables (`{dias_absolutos}` quedaba literal)
- **Ahora:** El pie dinámico se sustituye con las variables del cliente + la cuota con mayor atraso

Esto permite que las reglas PIE usen variables como `{dias_absolutos}`, `{Total Gs}`, `{Entidad}`, etc.

## Pasos para aplicar

### 1️⃣ Descargá y descomprimí este ZIP

### 2️⃣ Copiar los 2 archivos a tu repo local

**Archivo 1 (reemplazar existente):**
```
src/lib/mensajes.ts
→ ...caetutti-protocol\src\lib\mensajes.ts
```

**Archivo 2 (crear carpeta nueva + archivo):**
```
src/app/api/admin/seed-pie-rules/route.ts
→ ...caetutti-protocol\src\app\api\admin\seed-pie-rules\route.ts
```

### 3️⃣ GitHub Desktop — verás 2 archivos:
- `src/lib/mensajes.ts` (modificado)
- `src/app/api/admin/seed-pie-rules/route.ts` (nuevo)

### 4️⃣ Commit + Push:
- Mensaje: `feat: reglas PIE cliente/codeudor con tono gradual por días de atraso`
- **Commit to main** → **Push origin**

### 5️⃣ Esperá 2-3 min a que Vercel redeploye

---

## 🌱 Cómo crear las reglas (después del deploy)

1. Entrá a https://caetutti-protocol.vercel.app (logueate como admin/admin123)
2. Abrí la consola del navegador (**F12** → pestaña **Console**)
3. Pegá este código y dale **Enter**:

```javascript
fetch('/api/admin/seed-pie-rules', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sobreescribir: true })
})
.then(r => r.json())
.then(data => console.log('✅ Reglas PIE creadas:', data))
.catch(e => console.error('❌ Error:', e));
```

4. Vas a ver en la consola algo como:
```
✅ Reglas PIE creadas: {
  mensaje: "Reglas PIE creadas correctamente",
  reglasBorradas: 0,  // o las que ya existían
  reglasCreadas: 12,
  detalle: [
    { id: "...", nombre: "PIE CLIENTE — Por vencer / recién vencido (0-7 días)", tipo: "pie_cliente" },
    { id: "...", nombre: "PIE CLIENTE — Vencido leve (8-30 días)", tipo: "pie_cliente" },
    ...
    { id: "...", nombre: "PIE CODEUDOR — Por vencer / recién vencido (0-7 días)", tipo: "pie_codeudor" },
    ...
  ],
  rangos: [
    { dias: "0-7", tono: "Amable / preventivo" },
    { dias: "8-30", tono: "Cordial / recordatorio" },
    { dias: "31-60", tono: "Firme / urgente" },
    { dias: "61-90", tono: "Estricto / último aviso" },
    { dias: "91-180", tono: "Severo / derivación legal" },
    { dias: "181+", tono: "Crítico / judicial" }
  ]
}
```

5. ¡Listo! Las 12 reglas están creadas y activas.

---

## 🧪 Cómo probar que funcionan

1. Andá a **Notificaciones** en el sistema
2. Buscá un cliente con cuotas vencidas hace 0-7 días → botón **Ver** → el mensaje debe tener el pie amable
3. Buscá un cliente con cuotas vencidas hace 31-60 días → el mensaje debe tener el pie firme
4. Buscá un cliente con cuotas vencidas hace 91+ días → el mensaje debe tener el pie severo
5. Cambiá a la pestaña **Codeudores** → verificá que los pies de codeudor también se aplican

## 📋 Ejemplo de mensaje generado

Para un cliente con 45 días de atraso, el mensaje se vería así:

```
Estimado/a JUAN PEREZ, le informamos que tiene cuotas pendientes por un total de ₲ 1.500.000.

- Vence: 15/09/2026 · Saldo: ₲ 1.500.000 · vencido hace 45 días
- Vence: 15/10/2026 · Saldo: ₲ 800.000 · vencido hace 15 días

Su cuenta registra 45 días de mora. Le instamos a regularizar su pago de forma urgente,
ya que el interés por mora sigue acumulándose diariamente y podría afectar su calificación
crediticia.

Comuníquese a la brevedad con el Dpto. de Cobranzas para evitar mayores inconvenientes.

Dpto. de Cobranzas — Casa Central
VIZA HOME
```

## Lo que NO se tocó

- ✅ TemplateAgrupada y TemplateCodeudor — sin cambios (siguen controlando cabecera y detalle)
- ✅ Reglas individuales (tipo "individual") — sin cambios
- ✅ Webhook de WhatsApp — sin cambios
- ✅ Sistema de codeudores — sin cambios
- ✅ Endpoints de notificaciones — sin cambios

## Personalización

Si querés cambiar el tono de alguna regla:
1. Andá al módulo **Reglas** en el sistema (si existe) o modificá el archivo `seed-pie-rules/route.ts`
2. Cambiá el texto del campo `mensaje` de la regla que querés ajustar
3. Volver a ejecutar el endpoint `POST /api/admin/seed-pie-rules` con `{ sobreescribir: true }`

O si querés editar una regla individualmente sin recrear todas, usá el endpoint de reglas existente
(`/api/reglas`) para hacer PUT/PATCH a una regla específica por su ID.
