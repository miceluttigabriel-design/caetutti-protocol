import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, fail, unauthorized } from "@/lib/session";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return unauthorized();
  const { id } = await params;

  await db.metaTemplate.delete({
    where: { id, empresaId: user.empresaId },
  });

  return ok({ success: true });
}

/**
 * PUT /api/whatsapp/templates/[id]
 * Actualiza una plantilla local.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return unauthorized();
  const { id } = await params;
  const body = await req.json();

  const template = await db.metaTemplate.update({
    where: { id, empresaId: user.empresaId },
    data: {
      ...(body.cuerpo && { cuerpo: body.cuerpo }),
      ...(body.categoria && { categoria: body.categoria }),
      ...(body.idioma && { idioma: body.idioma }),
      ...(body.variables && { variables: JSON.stringify(body.variables) }),
    },
  });

  return ok({ template });
}
