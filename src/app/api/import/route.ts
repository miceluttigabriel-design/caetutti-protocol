import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";
import * as XLSX from "xlsx";

// ⚠️ IMPORTANTE: Esta ruta necesita más tiempo porque procesa
// miles de filas del Excel. En Vercel, el default es 10s.
export const maxDuration = 60; // 60 segundos para importación masiva
export const dynamic = "force-dynamic";

/**
 * POST /api/import
 * Body: FormData con file (xlsx o json)
 *
 * === MAPEO DE COLUMNAS DEL EXCEL REAL DEL CLIENTE ===
 *
 * COLUMNAS QUE VAN AL CLIENTE (datos personales, se actualizan en cada importación):
 *   - Codigo Entidad   → cliente.codigoEntidad (clave)
 *   - Entidad          → cliente.entidad (nombre completo)
 *   - Ci Entidad       → cliente.ciEntidad
 *   - Ruc Entidad      → cliente.rucEntidad
 *   - Telefono         → cliente.telefono
 *   - Telefono_pivot   → cliente.telefonoPivot
 *   - Localidad        → cliente.localidad
 *   - Vendedor         → cliente.vendedor (se parsea: "52813 - NOMBRE" → "NOMBRE")
 *   - Cobrador         → cliente.cobrador
 *   - Judicial         → cliente.judicial (SI/NO → S/N)
 *   - Informconf       → cliente.informconf (SI/NO → S/N)
 *   - Sucursal         → cliente.sucursalId (se crea si no existe)
 *
 * COLUMNAS QUE VAN A LA CUOTA (datos de la deuda, una fila = una cuota):
 *   - Fecha Emision    → cuota.fechaEmision (convierte Excel serial a Date)
 *   - Fecha Vcto       → cuota.fechaVcto (convierte Excel serial a Date)
 *   - Mes Vcto         → cuota.mesVcto (parsea "15-APRIL" → 4)
 *   - Ano Vcto         → cuota.anoVcto
 *   - Saldo en Gs      → cuota.saldoGs
 *   - Saldo Guarani    → cuota.saldoGuarani
 *   - Saldo Dolar      → cuota.saldoDolar
 *   - Venc Mes         → cuota.vencMes (monto original del mes)
 *   - Saldo Real       → (se descarta, se recalcula)
 *   - Moneda           → cuota.moneda
 *   - Dias Atrasado    → cuota.diasAtrasado
 *   - Pago Mes         → (se descarta por ahora)
 *   - Ult Comentario   → (se descarta, va a historial si necesario)
 *   - Fecha Prox Contacto → (se descarta, va a recordatorios si necesario)
 *   - Tipo Prox Contacto → (se descarta)
 *   - Mes Emision      → (se descarta, se calcula de Fecha Emision)
 *   - Ano Emision      → (se descarta, se calcula de Fecha Emision)
 */

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  const formData = await req.formData();
  const file = formData.get("file") as File;
  if (!file) return fail("Archivo requerido");

  const ext = file.name.toLowerCase().split(".").pop();
  if (!["xlsx", "xls", "json"].includes(ext || "")) {
    return fail("Formato no soportado. Use .xlsx, .xls o .json");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let rows: any[] = [];

  try {
    if (ext === "json") {
      const parsed = JSON.parse(buffer.toString("utf-8"));
      if (Array.isArray(parsed)) {
        rows = parsed;
      } else if (parsed.clientes && Array.isArray(parsed.clientes)) {
        return await importStructured(user.empresaId, parsed.clientes);
      } else {
        return fail("JSON inválido. Debe ser array o { clientes: [...] }");
      }
    } else {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    }
  } catch (e: any) {
    return fail(`Error al leer archivo: ${e.message}`);
  }

  if (rows.length === 0) return fail("El archivo está vacío");
  if (rows.length > 10000) return fail("Máximo 10,000 filas por importación");

  return await importRows(user.empresaId, rows);
}

// ============================================================
// IMPORTACIÓN DESDE FILAS (Excel o JSON plano)
// ============================================================

async function importRows(empresaId: string, rows: any[]) {
  const result = {
    clientesNuevos: 0,
    clientesActualizados: 0,
    cuotasProcesadas: 0,
    marcadasCobradas: 0,
    cuotasMarcadasCobradas: 0,
    codeudoresNuevos: 0,
    sucursalesCreadas: 0,
    errores: [] as string[],
    advertencias: [] as string[],
  };

  // Filas a ignorar (totales, vacías, etc.)
  const filasValidas = rows.filter((row) => {
    const codigo = String(row["Codigo Entidad"] ?? row["codigoEntidad"] ?? "").trim();
    const entidad = String(row["Entidad"] ?? row["entidad"] ?? "").trim();
    if (!codigo || !entidad) return false;
    // Ignorar filas de "Total" / "Suma"
    if (/total|suma|subtotal/i.test(codigo) || /total|suma/i.test(entidad)) return false;
    // Ignorar si Codigo Entidad no es número válido (filas de totales suelen tener texto)
    if (isNaN(Number(codigo)) && codigo.length > 20) return false;
    return true;
  });

  if (filasValidas.length < rows.length) {
    result.advertencias.push(`${rows.length - filasValidas.length} fila(s) ignorada(s) (vacías, totales o inválidas)`);
  }

  // Mapa de sucursales existentes
  const sucursalesExistentes = await db.sucursal.findMany({ where: { empresaId } });
  const sucMap = new Map(sucursalesExistentes.map((s) => [s.nombre.toUpperCase(), s]));

  // Cache de clientes
  const clienteCache = new Map<string, string>();

  for (let i = 0; i < filasValidas.length; i++) {
    const row = filasValidas[i];
    try {
      const codigoEntidad = String(row["Codigo Entidad"] ?? row["codigoEntidad"]).trim();
      const entidad = String(row["Entidad"] ?? row["entidad"]).trim();

      // === SUCURSAL ===
      const sucursalNombre = String(row["Sucursal"] ?? row["sucursal"] ?? "Principal").trim();
      let sucursal = sucMap.get(sucursalNombre.toUpperCase());
      if (!sucursal) {
        sucursal = await db.sucursal.create({
          data: { empresaId, nombre: sucursalNombre, codigo: `SUC-${sucMap.size + 1}` },
        });
        sucMap.set(sucursalNombre.toUpperCase(), sucursal);
        result.sucursalesCreadas++;
      }

      // === VENDEDOR (parsear "52813 - NOMBRE" → "NOMBRE") ===
      const vendedorRaw = String(row["Vendedor"] ?? row["vendedor"] ?? "").trim();
      const vendedor = parseVendedor(vendedorRaw);

      // === CLIENTE (datos personales) ===
      // Limpiar valores: "*" significa "sin dato" en el Excel del cliente
      const limpiar = (val: any) => {
        const s = String(val ?? "").trim();
        if (!s || s === "*" || s === "-") return null;
        return s;
      };

      const clienteData = {
        entidad,
        ciEntidad: limpiar(row["Ci Entidad"] ?? row["ciEntidad"]),
        rucEntidad: limpiar(row["Ruc Entidad"] ?? row["rucEntidad"]),
        localidad: limpiar(row["Localidad"] ?? row["localidad"]),
        telefono: normalizarTelefonoPY(String(row["Telefono"] ?? row["telefono"] ?? "").trim()),
        telefonoPivot: normalizarTelefonoPY(String(row["Telefono_pivot"] ?? row["Telefono pivot"] ?? "").trim()) || null,
        vendedor,
        cobrador: limpiar(row["Cobrador"] ?? row["cobrador"]),
        judicial: parseSiNo(String(row["Judicial"] ?? "").trim()),
        informconf: parseSiNo(String(row["Informconf"] ?? "").trim()),
        sucursalId: sucursal.id,
        estadoRegistro: "completo",
      };

      let clienteId = clienteCache.get(codigoEntidad);
      if (!clienteId) {
        const existente = await db.cliente.findUnique({
          where: { empresaId_codigoEntidad: { empresaId, codigoEntidad } },
        });
        if (existente) {
          clienteId = existente.id;
          clienteCache.set(codigoEntidad, clienteId);
          // Actualizar datos personales (sobrescribe)
          await db.cliente.update({ where: { id: clienteId }, data: clienteData });
          result.clientesActualizados++;
        } else {
          const nuevo = await db.cliente.create({
            data: { empresaId, codigoEntidad, ...clienteData },
          });
          clienteId = nuevo.id;
          clienteCache.set(codigoEntidad, clienteId);
          result.clientesNuevos++;
        }
      }

      // === CUOTA (datos de la deuda) ===
      const fechaEmision = parseFecha(row["Fecha Emision"] ?? row["fechaEmision"]);
      const fechaVcto = parseFecha(row["Fecha Vcto"] ?? row["fechaVcto"]);
      if (!fechaVcto) {
        result.errores.push(`Fila ${i + 2} (cliente ${codigoEntidad}): fecha de vencimiento inválida`);
        continue;
      }

      const saldoGs = parseNumero(row["Saldo en Gs"] ?? row["saldoGs"]);
      const diasAtrasado = parseNumero(row["Dias Atrasado"] ?? row["diasAtrasado"]);

      // === Calcular interés por mora (0.10% diario) ===
      const interesGs = diasAtrasado > 0 ? Math.round(saldoGs * 0.001 * diasAtrasado) : 0;
      const saldoTotalGs = saldoGs + interesGs;

      // Estado: si saldo es 0 → cobrada, si diasAtrasado > 0 → pendiente vencida
      const estado: string = saldoGs === 0 ? "cobrada" : "pendiente";
      if (estado === "cobrada") result.marcadasCobradas++;

      // Mes Vcto: "15-APRIL" → 4
      const mesVctoNum = parseMesTexto(String(row["Mes Vcto"] ?? "")) || (fechaVcto.getMonth() + 1);
      const anoVctoNum = Number(row["Ano Vcto"]) || fechaVcto.getFullYear();

      await db.cuota.create({
        data: {
          empresaId,
          sucursalId: sucursal.id,
          clienteId,
          fechaEmision: fechaEmision || fechaVcto,
          fechaVcto,
          mesVcto: mesVctoNum,
          anoVcto: anoVctoNum,
          saldoGs,
          interesGs,
          saldoTotalGs,
          tasaInteresDiaria: 0.001,
          saldoGuarani: parseNumero(row["Saldo Guarani"] ?? row["saldoGuarani"]) || null,
          saldoDolar: parseNumero(row["Saldo Dolar"] ?? row["saldoDolar"]) || null,
          vencMes: parseNumero(row["Venc Mes"] ?? row["vencMes"]) || saldoGs,
          moneda: String(row["Moneda"] ?? row["moneda"] ?? "Gs").trim().toUpperCase(),
          diasAtrasado,
          descripcion: `Importado el ${new Date().toISOString().slice(0, 10)}`,
          vendedor,
          estado,
        },
      });
      result.cuotasProcesadas++;
    } catch (e: any) {
      result.errores.push(`Fila ${i + 2}: ${e.message}`);
    }
  }

  return ok({ result });
}

// ============================================================
// IMPORTACIÓN ESTRUCTURADA JSON
// ============================================================

async function importStructured(empresaId: string, clientes: any[]) {
  const result = {
    clientesNuevos: 0,
    clientesActualizados: 0,
    cuotasProcesadas: 0,
    marcadasCobradas: 0,
    cuotasMarcadasCobradas: 0,
    codeudoresNuevos: 0,
    sucursalesCreadas: 0,
    errores: [] as string[],
    advertencias: [] as string[],
  };

  for (const c of clientes) {
    try {
      if (!c.codigoEntidad || !c.entidad) {
        result.errores.push(`Cliente sin codigoEntidad o entidad`);
        continue;
      }
      let cliente = await db.cliente.findUnique({
        where: { empresaId_codigoEntidad: { empresaId, codigoEntidad: String(c.codigoEntidad) } },
      });
      if (cliente) {
        cliente = await db.cliente.update({
          where: { id: cliente.id },
          data: {
            entidad: c.entidad,
            ciEntidad: c.ciEntidad, rucEntidad: c.rucEntidad,
            localidad: c.localidad, telefono: c.telefono, telefonoPivot: c.telefonoPivot,
            vendedor: c.vendedor, cobrador: c.cobrador,
            judicial: c.judicial || "N", informconf: c.informconf || "N",
          },
        });
        result.clientesActualizados++;
      } else {
        cliente = await db.cliente.create({
          data: {
            empresaId, codigoEntidad: String(c.codigoEntidad), entidad: c.entidad,
            ciEntidad: c.ciEntidad, rucEntidad: c.rucEntidad,
            localidad: c.localidad, telefono: c.telefono, telefonoPivot: c.telefonoPivot,
            vendedor: c.vendedor, cobrador: c.cobrador,
            judicial: c.judicial || "N", informconf: c.informconf || "N",
            estadoRegistro: "completo",
          },
        });
        result.clientesNuevos++;
      }

      // === Obtener cuotas pendientes existentes ANTES de procesar el Excel ===
      // Esto nos permite saber cuáles NO vinieron en el Excel nuevo y marcarlas como cobradas
      const cuotasPendientesAntes = await db.cuota.findMany({
        where: { clienteId: cliente.id, estado: "pendiente" },
        select: { id: true, fechaVcto: true, saldoGs: true, montoEditado: true },
      });
      const fechasProcesadas = new Set<string>(); // track de fechas que vinieron en el Excel

      for (const q of c.cuotas || []) {
        const fechaVcto = parseFecha(q.fechaVcto);
        if (!fechaVcto) continue;

        // Marcar esta fecha como procesada (vinoy en el Excel)
        fechasProcesadas.add(fechaVcto.getTime().toString());

        // === Lógica de re-importación ===
        // Reglas para NO perder información al re-importar:
        // 1. Si montoEditado=true → NO pisar el saldoGs editado
        // 2. Si estado="cobrada" → NO volver a pendiente (sigue cobrada)
        // 3. Siempre mantener notificado y ultimaNotificacion
        // 4. Recalcular interés y días automáticamente
        const cuotaExistente = await db.cuota.findFirst({
          where: { clienteId: cliente.id, fechaVcto },
        });

        if (cuotaExistente) {
          // === Caso A: Cuota ya existe ===
          // Decidir qué saldo usar: si fue editado, mantener el editado; si no, usar el del Excel
          const saldoFinal = cuotaExistente.montoEditado
            ? cuotaExistente.saldoGs  // mantener el editado
            : (Number(q.saldoGs) || 0);  // usar el del Excel

          // Recalcular días basado en la fecha (siempre se actualiza diariamente)
          const { recalcularInteresPorFecha } = await import("@/lib/interes");
          const recalc = recalcularInteresPorFecha(saldoFinal, fechaVcto, cuotaExistente.tasaInteresDiaria);

          // Si la cuota fue editada (saldoGs y/o interesGs), NO pisar esos valores
          if (cuotaExistente.montoEditado) {
            // Calcular el saldoTotalGs según si el interés es manual o automático
            const interesFinal = cuotaExistente.interesManual
              ? cuotaExistente.interesGs  // mantener el interés manual
              : recalc.interesGs;          // recalcular automáticamente

            await db.cuota.update({
              where: { id: cuotaExistente.id },
              data: {
                // Actualizar días siempre (cambia diariamente)
                diasAtrasado: recalc.diasAtrasado,
                // Si interesManual=true, mantener el interés; si no, recalcular
                interesGs: interesFinal,
                saldoTotalGs: saldoFinal + interesFinal,
                // NO tocar saldoGs (fue editado)
                // NO tocar estado, notificado, ultimaNotificacion, interesManual
              },
            });
          } else {
            // Cuota no editada → actualizar con datos del Excel, pero respetando:
            // - estado: si estaba cobrada, mantenerla cobrada
            const estadoFinal = cuotaExistente.estado === "cobrada"
              ? "cobrada"
              : (q.estado || cuotaExistente.estado || "pendiente");

            await db.cuota.update({
              where: { id: cuotaExistente.id },
              data: {
                fechaEmision: parseFecha(q.fechaEmision) || fechaVcto,
                saldoGs: saldoFinal,
                diasAtrasado: recalc.diasAtrasado,
                interesGs: recalc.interesGs,
                saldoTotalGs: recalc.saldoTotalGs,
                descripcion: q.descripcion || cuotaExistente.descripcion,
                vendedor: q.vendedor || c.vendedor,
                moneda: q.moneda || cuotaExistente.moneda || "Gs",
                estado: estadoFinal,
                // NO tocar notificado ni ultimaNotificacion
              },
            });
          }
        } else {
          // === Caso B: Cuota nueva → crear ===
          const saldoInicial = Number(q.saldoGs) || 0;
          const { recalcularInteresPorFecha } = await import("@/lib/interes");
          const recalc = recalcularInteresPorFecha(saldoInicial, fechaVcto);

          await db.cuota.create({
            data: {
              empresaId, clienteId: cliente.id,
              fechaEmision: parseFecha(q.fechaEmision) || fechaVcto,
              fechaVcto,
              saldoGs: saldoInicial,
              diasAtrasado: recalc.diasAtrasado,
              interesGs: recalc.interesGs,
              saldoTotalGs: recalc.saldoTotalGs,
              tasaInteresDiaria: 0.001,
              descripcion: q.descripcion,
              vendedor: q.vendedor || c.vendedor,
              moneda: q.moneda || "Gs",
              estado: q.estado || "pendiente",
            },
          });
        }
        result.cuotasProcesadas++;
      }

      // === Marcar como COBRADAS las cuotas pendientes que NO vinieron en el Excel ===
      // Regla del negocio: si una cuota pendiente no viene en la nueva importación,
      // significa que el cliente ya la pagó → marcar como cobrada
      // (incluso si fue editada manualmente antes — el pago es prioritario)
      let cuotasMarcadasCobradas = 0;
      for (const cuotaPendiente of cuotasPendientesAntes) {
        const fechaKey = cuotaPendiente.fechaVcto.getTime().toString();
        if (!fechasProcesadas.has(fechaKey)) {
          // Esta cuota NO vino en el Excel → marcar como cobrada
          await db.cuota.update({
            where: { id: cuotaPendiente.id },
            data: {
              estado: "cobrada",
              // Mantener saldoGs, montoEditado, notificado, ultimaNotificacion (historial)
              // No tocar interés ni días (queda con el último cálculo)
            },
          });
          cuotasMarcadasCobradas++;
        }
      }
      if (cuotasMarcadasCobradas > 0) {
        result.cuotasMarcadasCobradas = (result.cuotasMarcadasCobradas || 0) + cuotasMarcadasCobradas;
      }
    } catch (e: any) {
      result.errores.push(`${c.codigoEntidad}: ${e.message}`);
    }
  }
  return ok({ result });
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Convierte Excel serial (número) o string a Date.
 * - 44993 → 2023-02-21
 * - "2025-01-15" → Date
 * - "15/01/2025" → Date
 */
function parseFecha(v: any): Date | null {
  if (v === "" || v === null || v === undefined) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;

  // Excel serial number — interpretarlo como fecha a medianoche LOCAL (no UTC).
  // Antes se hacía `new Date(ms)` que crea en UTC y luego al mostrar en hora local
  // (Paraguay UTC-3) se "corría" un día atrás (ej: 01/11 → 31/10).
  // Ahora: extraemos Y/M/D del serial y creamos con `new Date(y, m, d)` que es local.
  if (typeof v === "number" && v > 30000 && v < 80000) {
    // Excel epoch: 1900-01-01 = 1 (con bug de año bisiesto, 25569 = 1970-01-01)
    const ms = (v - 25569) * 86400 * 1000;
    const utc = new Date(ms); // UTC puro
    // Construir fecha local usando los componentes UTC (son los "correctos" del Excel)
    const local = new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate(), 0, 0, 0, 0);
    return isNaN(local.getTime()) ? null : local;
  }

  const s = String(v).trim();
  // YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // DD/MM/YYYY
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  // DD-MM-YYYY
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Normaliza teléfonos paraguayos a formato consistente "0XXXXXXXXX".
 * - "0986101358" → "0986101358"
 * - "985506942" → "0985506942" (agrega 0 inicial)
 * - "47230482" → "047230482" (agrega 0, teléfono fijo)
 * - "0981-059142" → "0981059142" (quita guion)
 * - "+554796693136" → "554796693136" (internacional, se mantiene)
 */
function normalizarTelefonoPY(t: string): string | null {
  if (!t) return null;
  let clean = String(t).replace(/\D/g, "");
  if (clean.length === 0) return null;

  // Internacional (mantener completo)
  if (clean.startsWith("55") && clean.length >= 12) return clean;
  if (clean.startsWith("595") && clean.length >= 12) return "0" + clean.slice(3);
  // 09XX XXX XXX (10 dígitos) → OK
  if (clean.length === 10 && clean.startsWith("09")) return clean;
  // 9XX XXX XXX (9 dígitos, sin 0 inicial) → agregar 0
  if (clean.length === 9 && clean.startsWith("9")) return "0" + clean;
  // 4XX XXX XX (8 dígitos, teléfono fijo Asunción) → agregar 0
  if (clean.length === 8 && clean.startsWith("4")) return "0" + clean;
  // 0XX XXX XXX (teléfono fijo)
  if (clean.length === 9 && clean.startsWith("0")) return clean;

  // Cualquier otro caso: devolver tal cual
  return clean;
}

/**
 * Convierte "SI"/"NO"/"S"/"N"/"true"/"false" → "S"/"N"
 */
function parseSiNo(v: string): string {
  const s = v.toUpperCase().trim();
  if (s.startsWith("S") && s !== "NO") return "S"; // SI, S, true
  if (s.startsWith("N")) return "N"; // NO, N
  return "N";
}

/**
 * Parsea "52813 - AGUILERA PEREIRA, ROLAN MOISES" → "AGUILERA PEREIRA, ROLAN MOISES"
 */
function parseVendedor(v: string): string | null {
  if (!v) return null;
  const s = String(v).trim();
  // Formato "12345 - NOMBRE"
  const m = s.match(/^\d+\s*-\s*(.+)$/);
  if (m) return m[1].trim();
  return s || null;
}

/**
 * Convierte "15-APRIL" → 4, "07-APR" → 4, etc.
 */
function parseMesTexto(v: string): number | null {
  if (!v) return null;
  const meses: Record<string, number> = {
    JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
    JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
    ENE: 1, ABR: 4, AGO: 8, SET: 9, DIC: 12,
  };
  const s = v.toUpperCase();
  for (const [k, n] of Object.entries(meses)) {
    if (s.includes(k)) return n;
  }
  // Si es solo un número
  const num = Number(v);
  if (!isNaN(num) && num >= 1 && num <= 12) return num;
  return null;
}

/**
 * Parsea números que pueden venir como string con separadores o como número.
 */
function parseNumero(v: any): number {
  if (typeof v === "number") return v;
  if (!v) return 0;
  const s = String(v).replace(/[^\d.-]/g, "");
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}
