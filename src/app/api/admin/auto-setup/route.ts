import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/auto-setup
 *
 * Ejecuta en un solo request:
 *   1. Borra las sucursales ficticias (CENTRAL ASUNCION, SUCURSAL CAPIATA, SUCURSAL SAN LORENZO)
 *      y reasigna sus clientes/cuotas a "Principal"
 *   2. Recalcula diasAtrasado, interesGs y saldoTotalGs de todas las cuotas pendientes
 *
 * Requiere permiso de admin.
 *
 * Body (opcional):
 *   { sucursales?: string[] }  // default: las 3 ficticias conocidas
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

  const sucursalesABorrar: string[] = Array.isArray(body.sucursales) && body.sucursales.length > 0
    ? body.sucursales.map((s: any) => String(s).trim()).filter(Boolean)
    : ["CENTRAL ASUNCION", "SUCURSAL CAPIATA", "SUCURSAL SAN LORENZO"];

  // ============================================================
  // FASE 1: Limpiar sucursales ficticias
  // ============================================================
  let sucursalPrincipal = await db.sucursal.findFirst({
    where: { empresaId: user.empresaId, nombre: "Principal" },
  });

  if (!sucursalPrincipal) {
    sucursalPrincipal = await db.sucursal.create({
      data: {
        empresaId: user.empresaId,
        nombre: "Principal",
        codigo: "SUC-MAIN",
      },
    });
  }

  const resultadosSucursales: any[] = [];
  for (const nombreSuc of sucursalesABorrar) {
    const resultado: any = {
      nombre: nombreSuc,
      encontrada: false,
      clientesMovidos: 0,
      cuotasMovidas: 0,
      borrada: false,
    };
    try {
      const suc = await db.sucursal.findFirst({
        where: {
          empresaId: user.empresaId,
          nombre: { equals: nombreSuc, mode: "insensitive" as const },
        },
      });
      if (!suc) {
        resultadosSucursales.push(resultado);
        continue;
      }
      resultado.encontrada = true;

      const clientesMovidos = await db.cliente.updateMany({
        where: { sucursalId: suc.id },
        data: { sucursalId: sucursalPrincipal.id },
      });
      resultado.clientesMovidos = clientesMovidos.count;

      const cuotasMovidas = await db.cuota.updateMany({
        where: { sucursalId: suc.id },
        data: { sucursalId: sucursalPrincipal.id },
      });
      resultado.cuotasMovidas = cuotasMovidas.count;

      await db.ventaMes.updateMany({
        where: { sucursalId: suc.id },
        data: { sucursalId: sucursalPrincipal.id },
      }).catch(() => {});

      await db.objetivoDinamico.updateMany({
        where: { sucursalId: suc.id },
        data: { sucursalId: sucursalPrincipal.id },
      }).catch(() => {});

      await db.sucursal.delete({ where: { id: suc.id } });
      resultado.borrada = true;
      resultadosSucursales.push(resultado);
    } catch (e: any) {
      resultado.error = e.message || "Error desconocido";
      resultadosSucursales.push(resultado);
    }
  }

  // ============================================================
  // FASE 2: Recalcular días e interés de todas las cuotas pendientes
  // ============================================================
  const cuotas = await db.cuota.findMany({
    where: {
      empresaId: user.empresaId,
      estado: "pendiente",
    },
    select: {
      id: true,
      fechaVcto: true,
      saldoGs: true,
      diasAtrasado: true,
      interesGs: true,
      interesManual: true,
      tasaInteresDiaria: true,
    },
  });

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  let actualizadas = 0;
  let sinCambios = 0;
  let errores = 0;

  const LOTES = 50;
  for (let i = 0; i < cuotas.length; i += LOTES) {
    const lote = cuotas.slice(i, i + LOTES);
    await Promise.all(
      lote.map(async (q) => {
        try {
          const vcto = new Date(q.fechaVcto);
          vcto.setHours(0, 0, 0, 0);
          const diffMs = hoy.getTime() - vcto.getTime();
          const diasCalculados = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

          if (diasCalculados === q.diasAtrasado) {
            sinCambios++;
            return;
          }

          const tasa = q.tasaInteresDiaria ?? 0.001;
          const nuevoInteres = q.interesManual
            ? q.interesGs
            : Math.round((q.saldoGs || 0) * tasa * diasCalculados);
          const nuevoTotal = (q.saldoGs || 0) + nuevoInteres;

          await db.cuota.update({
            where: { id: q.id },
            data: {
              diasAtrasado: diasCalculados,
              interesGs: nuevoInteres,
              saldoTotalGs: nuevoTotal,
            },
          });
          actualizadas++;
        } catch {
          errores++;
        }
      })
    );
  }

  return ok({
    mensaje: "Auto-setup completado: sucursales limpias + días recalculados",
    fase1_sucursales: {
      sucursalDestino: "Principal",
      resultados: resultadosSucursales,
    },
    fase2_recalculo: {
      totalCuotas: cuotas.length,
      actualizadas,
      sinCambios,
      errores,
      fechaCalculo: hoy.toISOString(),
    },
  });
}
