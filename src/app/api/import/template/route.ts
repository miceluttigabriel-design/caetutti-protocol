import { db } from "@/lib/db";
import { getSession, ok, unauthorized } from "@/lib/session";
import * as XLSX from "xlsx";

/**
 * GET /api/import/template
 * Devuelve una plantilla Excel .xlsx con las columnas correctas (formato real del cliente) + 2 filas de ejemplo.
 */
export async function GET() {
  const user = await getSession();
  if (!user) return unauthorized();

  // Orden de columnas = mismo orden que el Excel original del cliente
  const columns = [
    "Sucursal",
    "Vendedor",
    "Tipo Prox Contacto",
    "Cobrador",
    "Judicial",
    "Informconf",
    "Dias Atrasado",
    "Ruc Entidad",
    "Ci Entidad",
    "Telefono_pivot",
    "Mes Vcto",
    "Ano Vcto",
    "Mes Emision",
    "Ano Emision",
    "Fecha Emision",
    "Pago Mes",
    "Saldo en Gs",
    "Venc Mes",
    "Saldo Real",
    "Localidad",
    "Codigo Entidad",
    "Entidad",
    "Fecha Vcto",
    "Moneda",
    "Saldo Dolar",
    "Saldo Guarani",
    "Ult Comentario",
    "Fecha Prox Contacto",
    "Telefono",
  ];

  const ejemplos = [
    {
      "Sucursal": "CENTRAL ASUNCION",
      "Vendedor": "52813 - AGUILERA PEREIRA, ROLAN MOISES",
      "Tipo Prox Contacto": "",
      "Cobrador": "BENITEZ MOLINA, LUZ MARINA",
      "Judicial": "NO",
      "Informconf": "SI",
      "Dias Atrasado": 7,
      "Ruc Entidad": "1234567-8",
      "Ci Entidad": "1234567",
      "Telefono_pivot": "0981123456",
      "Mes Vcto": "15-APRIL",
      "Ano Vcto": "2025",
      "Mes Emision": "06-MAY",
      "Ano Emision": "2025",
      "Fecha Emision": "2025-04-15",
      "Pago Mes": "",
      "Saldo en Gs": 450000,
      "Venc Mes": 450000,
      "Saldo Real": 0,
      "Localidad": "Asunción",
      "Codigo Entidad": 100001,
      "Entidad": "JUAN PEREZ GARCIA",
      "Fecha Vcto": "2025-10-15",
      "Moneda": "GS",
      "Saldo Dolar": 0,
      "Saldo Guarani": 450000,
      "Ult Comentario": "",
      "Fecha Prox Contacto": "",
      "Telefono": "0981123456",
    },
    {
      "Sucursal": "SUCURSAL SAN LORENZO",
      "Vendedor": "14096 - ALVES DUARTE, CARLOS",
      "Tipo Prox Contacto": "",
      "Cobrador": "",
      "Judicial": "NO",
      "Informconf": "NO",
      "Dias Atrasado": 0,
      "Ruc Entidad": "9876543-2",
      "Ci Entidad": "9876543",
      "Telefono_pivot": "",
      "Mes Vcto": "20-MAY",
      "Ano Vcto": "2025",
      "Mes Emision": "20-MAY",
      "Ano Emision": "2025",
      "Fecha Emision": "2025-05-20",
      "Pago Mes": "",
      "Saldo en Gs": 1200000,
      "Venc Mes": 1200000,
      "Saldo Real": 0,
      "Localidad": "San Lorenzo",
      "Codigo Entidad": 100002,
      "Entidad": "MARIA GONZALEZ LOPEZ",
      "Fecha Vcto": "2025-11-20",
      "Moneda": "GS",
      "Saldo Dolar": 0,
      "Saldo Guarani": 1200000,
      "Ult Comentario": "",
      "Fecha Prox Contacto": "",
      "Telefono": "0991876543",
    },
  ];

  const ws = XLSX.utils.json_to_sheet(ejemplos, { header: columns });
  // Set column widths
  ws["!cols"] = columns.map((c) => ({ wch: Math.max(c.length + 2, 14) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cuotas");

  // Segunda hoja: instrucciones
  const instrucciones = [
    { Campo: "Sucursal", "Va a": "Cliente", Descripción: "Sucursal donde se originó la venta. Se crea automáticamente si no existe." },
    { Campo: "Vendedor", "Va a": "Cliente", Descripción: "Formato: 'CÓDIGO - NOMBRE'. Se parsea automáticamente para extraer solo el nombre." },
    { Campo: "Tipo Prox Contacto", "Va a": "(ignorado)", Descripción: "Se descarta en la importación." },
    { Campo: "Cobrador", "Va a": "Cliente", Descripción: "Nombre del cobrador asignado." },
    { Campo: "Judicial", "Va a": "Cliente", Descripción: "SI o NO. Se normaliza a S/N." },
    { Campo: "Informconf", "Va a": "Cliente", Descripción: "SI o NO. Se normaliza a S/N." },
    { Campo: "Dias Atrasado", "Va a": "Cuota", Descripción: "Días de atraso respecto al vencimiento." },
    { Campo: "Ruc Entidad", "Va a": "Cliente", Descripción: "RUC del cliente." },
    { Campo: "Ci Entidad", "Va a": "Cliente", Descripción: "Cédula de identidad." },
    { Campo: "Telefono_pivot", "Va a": "Cliente", Descripción: "Teléfono alternativo. Se normaliza (0986101358 o 985506942)." },
    { Campo: "Mes Vcto", "Va a": "Cuota", Descripción: "Formato: '15-APRIL' o número 1-12. Se parsea automáticamente." },
    { Campo: "Ano Vcto", "Va a": "Cuota", Descripción: "Año de vencimiento (4 dígitos)." },
    { Campo: "Mes Emision", "Va a": "(ignorado)", Descripción: "Se calcula de Fecha Emision." },
    { Campo: "Ano Emision", "Va a": "(ignorado)", Descripción: "Se calcula de Fecha Emision." },
    { Campo: "Fecha Emision", "Va a": "Cuota", Descripción: "Fecha de emisión. Acepta Excel serial (44993) o YYYY-MM-DD." },
    { Campo: "Pago Mes", "Va a": "(ignorado)", Descripción: "Se descarta en la importación." },
    { Campo: "Saldo en Gs", "Va a": "Cuota", Descripción: "Saldo pendiente en Guaraníes. Si es 0, se marca como cobrada." },
    { Campo: "Venc Mes", "Va a": "Cuota", Descripción: "Monto original del mes." },
    { Campo: "Saldo Real", "Va a": "(ignorado)", Descripción: "Se descarta, se recalcula." },
    { Campo: "Localidad", "Va a": "Cliente", Descripción: "Ciudad o localidad." },
    { Campo: "Codigo Entidad", "Va a": "Cliente (clave)", Descripción: "CÓDIGO ÚNICO del cliente. Si existe, se actualiza; si no, se crea." },
    { Campo: "Entidad", "Va a": "Cliente", Descripción: "Nombre completo del cliente." },
    { Campo: "Fecha Vcto", "Va a": "Cuota", Descripción: "Fecha de vencimiento. Acepta Excel serial o YYYY-MM-DD." },
    { Campo: "Moneda", "Va a": "Cuota", Descripción: "GS, USD, etc." },
    { Campo: "Saldo Dolar", "Va a": "Cuota", Descripción: "Saldo en dólares (si aplica)." },
    { Campo: "Saldo Guarani", "Va a": "Cuota", Descripción: "Saldo adicional en Guaraníes." },
    { Campo: "Ult Comentario", "Va a": "(ignorado)", Descripción: "Se descarta en la importación." },
    { Campo: "Fecha Prox Contacto", "Va a": "(ignorado)", Descripción: "Se descarta en la importación." },
    { Campo: "Telefono", "Va a": "Cliente", Descripción: "Teléfono principal. Se normaliza: 0986101358, 985506942, 47230482 → 047230482." },
  ];
  const ws2 = XLSX.utils.json_to_sheet(instrucciones);
  ws2["!cols"] = [{ wch: 22 }, { wch: 18 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Instrucciones");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="plantilla_importacion_cuotas.xlsx"`,
    },
  });
}
