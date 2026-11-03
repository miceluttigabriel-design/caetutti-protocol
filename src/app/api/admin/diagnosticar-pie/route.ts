import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/diagnosticar-pie
 *
 * Diagnostica TODO lo relacionado con las reglas PIE:
 *   1. Cuántas reglas hay por tipo (individual, pie_cliente, pie_codeudor)
 *   2. Estado de TemplateAgrupada.usarReglasDinamicas
 *   3. Estado de TemplateCodeudor.usarReglasDinamicas
 *   4. Lista de reglas pie_cliente con sus rangos
 *   5. Lista de reglas pie_codeudor con sus rangos
 *   6. Para una muestra de 5 clientes pendientes: muestra sus días reales y qué regla se seleccionaría
 *
 * POST /api/admin/diagnosticar-pie
 *   { arreglar: true }
 *   - Pone usarReglasDinamicas=true en TemplateAgrupada y TemplateCodeudor
 *   - Pone activa=true en todas las reglas pie
 *   - No borra ni modifica mensajes, solo activa flags
 */
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();

  // 1. Conteo de reglas por tipo
  const reglas = await db.regla.findMany({
    where: { empresaId: user.empresaId },
    orderBy: { ordenPie: "asc" },
  });

  const conteo = {
    individual: reglas.filter((r) => r.tipo === "individual").length,
    pie_cliente: reglas.filter((r) => r.tipo === "pie_cliente").length,
    pie_codeudor: reglas.filter((r) => r.tipo === "pie_codeudor").length,
    otras: reglas.filter((r) => !["individual", "pie_cliente", "pie_codeudor"].includes(r.tipo)).length,
  };

  // 2. Estado de templates
  const templateAgrupada = await db.templateAgrupada.findUnique({ where: { empresaId: user.empresaId } });
  const templateCodeudor = await db.templateCodeudor.findUnique({ where: { empresaId: user.empresaId } });

  // 3. Lista de reglas pie_cliente con sus rangos
  const reglasPieCliente = reglas
    .filter((r) => r.tipo === "pie_cliente")
    .map((r) => ({
      id: r.id,
      nombre: r.nombre,
      diasMinPie: r.diasMinPie,
      diasMaxPie: r.diasMaxPie,
      ordenPie: r.ordenPie,
      activa: r.activa,
      mensajePreview: (r.mensaje || "").substring(0, 80) + "...",
    }));

  const reglasPieCodeudor = reglas
    .filter((r) => r.tipo === "pie_codeudor")
    .map((r) => ({
      id: r.id,
      nombre: r.nombre,
      diasMinPie: r.diasMinPie,
      diasMaxPie: r.diasMaxPie,
      ordenPie: r.ordenPie,
      activa: r.activa,
      mensajePreview: (r.mensaje || "").substring(0, 80) + "...",
    }));

  // 4. Muestra de 5 clientes pendientes con sus días reales y qué regla se seleccionaría
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const clientesMuestra = await db.cliente.findMany({
    where: {
      empresaId: user.empresaId,
      cuotas: { some: { estado: "pendiente" } },
    },
    include: {
      cuotas: {
        where: { estado: "pendiente" },
        select: { id: true, fechaVcto: true, saldoGs: true, diasAtrasado: true },
        take: 3,
      },
    },
    take: 5,
  });

  const muestraClientes = clientesMuestra.map((c) => {
    // Calcular días reales al vuelo
    const cuotasConDiasReales = c.cuotas.map((q) => {
      const vcto = new Date(q.fechaVcto);
      vcto.setHours(0, 0, 0, 0);
      const diffMs = hoy.getTime() - vcto.getTime();
      const diasReales = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      return {
        id: q.id,
        fechaVcto: q.fechaVcto,
        diasEnDB: q.diasAtrasado, // ← lo que está guardado en la DB
        diasReales, // ← lo que debería ser
        discrepancia: q.diasAtrasado !== diasReales ? "❌ DIFERENTE" : "✓ OK",
      };
    });

    const maxDiasReales = Math.max(0, ...cuotasConDiasReales.map((q) => q.diasReales));
    const maxDiasDB = Math.max(0, ...c.cuotas.map((q) => q.diasAtrasado ?? 0));

    // Simular selección de regla pie_cliente con días REALES
    let reglaSeleccionada = null;
    for (const r of reglas.filter((r) => r.tipo === "pie_cliente" && r.activa)) {
      const min = r.diasMinPie ?? 0;
      const max = r.diasMaxPie ?? -1;
      if (max === -1) {
        if (maxDiasReales >= min) {
          reglaSeleccionada = r.nombre;
          break;
        }
      } else {
        if (maxDiasReales >= min && maxDiasReales <= max) {
          reglaSeleccionada = r.nombre;
          break;
        }
      }
    }

    return {
      clienteId: c.id,
      entidad: c.entidad,
      codigoEntidad: c.codigoEntidad,
      maxDiasReales,
      maxDiasDB,
      reglaPieQueDeberiaSeleccionarse: reglaSeleccionada || "(ninguna — fallback a pieEstatico)",
      cuotas: cuotasConDiasReales,
    };
  });

  // 5. Detectar problemas
  const problemas: string[] = [];

  if (conteo.pie_cliente === 0) {
    problemas.push("❌ No hay reglas pie_cliente creadas");
  }
  if (conteo.pie_codeudor === 0) {
    problemas.push("❌ No hay reglas pie_codeudor creadas");
  }
  if (templateAgrupada && !templateAgrupada.usarReglasDinamicas) {
    problemas.push("❌ TemplateAgrupada.usarReglasDinamicas = FALSE (las reglas pie_cliente no se usan)");
  }
  if (templateCodeudor && !templateCodeudor.usarReglasDinamicas) {
    problemas.push("❌ TemplateCodeudor.usarReglasDinamicas = FALSE (las reglas pie_codeudor no se usan)");
  }
  const reglasPieInactivas = reglas.filter((r) =>
    (r.tipo === "pie_cliente" || r.tipo === "pie_codeudor") && !r.activa
  );
  if (reglasPieInactivas.length > 0) {
    problemas.push(`❌ Hay ${reglasPieInactivas.length} regla(s) pie inactiva(s)`);
  }

  // Verificar si hay mismatch entre días DB vs reales
  const clientesConDiscrepancia = muestraClientes.filter((c) => c.maxDiasDB !== c.maxDiasReales);
  if (clientesConDiscrepancia.length > 0) {
    problemas.push(`❌ ${clientesConDiscrepancia.length} de ${muestraClientes.length} clientes tienen diasAtrasado desactualizado en la DB (ejecutar /api/admin/recalcular-dias)`);
  }

  if (problemas.length === 0) {
    problemas.push("✅ Todo OK — las reglas PIE deberían funcionar correctamente");
  }

  return ok({
    resumen: {
      totalReglas: reglas.length,
      conteoPorTipo: conteo,
      templateAgrupada: templateAgrupada
        ? { usarReglasDinamicas: templateAgrupada.usarReglasDinamicas, tienePieEstatico: !!templateAgrupada.pieEstatico }
        : "no existe (se crea con defaults al primer uso)",
      templateCodeudor: templateCodeudor
        ? { usarReglasDinamicas: templateCodeudor.usarReglasDinamicas, tienePieEstatico: !!templateCodeudor.pieEstatico }
        : "no existe (se crea con defaults al primer uso)",
    },
    reglasPieCliente,
    reglasPieCodeudor,
    muestraClientes,
    problemas,
  });
}

/**
 * POST /api/admin/diagnosticar-pie
 * Body: { arreglar: true }
 *
 * Arregla automáticamente:
 *   - Pone usarReglasDinamicas=true en TemplateAgrupada y TemplateCodeudor
 *   - Pone activa=true en todas las reglas pie
 *   - No modifica mensajes ni rangos
 */
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return unauthorized();
  if (user.rol !== "admin") {
    return fail("Solo el admin puede ejecutar esta acción", 403);
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (!body.arreglar) {
    return fail("Pasá { arreglar: true } en el body para ejecutar la reparación");
  }

  const acciones: string[] = [];

  // 1. Activar usarReglasDinamicas en TemplateAgrupada
  const ta = await db.templateAgrupada.findUnique({ where: { empresaId: user.empresaId } });
  if (ta && !ta.usarReglasDinamicas) {
    await db.templateAgrupada.update({
      where: { id: ta.id },
      data: { usarReglasDinamicas: true },
    });
    acciones.push("✅ TemplateAgrupada.usarReglasDinamicas → TRUE");
  } else if (!ta) {
    acciones.push("ℹ️ TemplateAgrupada no existe (se creará con usarReglasDinamicas=true al primer uso)");
  } else {
    acciones.push("✓ TemplateAgrupada.usarReglasDinamicas ya era TRUE");
  }

  // 2. Activar usarReglasDinamicas en TemplateCodeudor
  const tc = await db.templateCodeudor.findUnique({ where: { empresaId: user.empresaId } });
  if (tc && !tc.usarReglasDinamicas) {
    await db.templateCodeudor.update({
      where: { id: tc.id },
      data: { usarReglasDinamicas: true },
    });
    acciones.push("✅ TemplateCodeudor.usarReglasDinamicas → TRUE");
  } else if (!tc) {
    acciones.push("ℹ️ TemplateCodeudor no existe (se creará con usarReglasDinamicas=true al primer uso)");
  } else {
    acciones.push("✓ TemplateCodeudor.usarReglasDinamicas ya era TRUE");
  }

  // 3. Activar todas las reglas pie
  const inactivas = await db.regla.findMany({
    where: {
      empresaId: user.empresaId,
      tipo: { in: ["pie_cliente", "pie_codeudor"] },
      activa: false,
    },
  });
  if (inactivas.length > 0) {
    await db.regla.updateMany({
      where: {
        empresaId: user.empresaId,
        tipo: { in: ["pie_cliente", "pie_codeudor"] },
        activa: false,
      },
      data: { activa: true },
    });
    acciones.push(`✅ ${inactivas.length} regla(s) pie inactiva(s) → activada(s)`);
  } else {
    acciones.push("✓ Todas las reglas pie ya estaban activas");
  }

  return ok({
    mensaje: "Reparación completada",
    acciones,
  });
}
