import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { isTopicMember } from "@/lib/topic-access";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; professionalId: string }> },
) {
  const { session, response } = await requireUser();
  if (!session) return response!;
  const { id: topicId, professionalId } = await ctx.params;

  if (!(await isTopicMember(topicId, session.userId))) {
    return NextResponse.json({ error: "אין גישה לנושא" }, { status: 403 });
  }

  const existing = await prisma.topicProfessional.findFirst({
    where: { id: professionalId, topicId },
  });
  if (!existing) {
    return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
  }

  let body: { name?: unknown; role?: unknown; phone?: unknown; notes?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "גוף בקשה לא תקין" }, { status: 400 });
  }

  const data: { name?: string; role?: string | null; phone?: string; notes?: string | null } = {};
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.role !== undefined) data.role = String(body.role).trim() || null;
  if (body.phone !== undefined) data.phone = String(body.phone).trim();
  if (body.notes !== undefined) data.notes = String(body.notes).trim() || null;

  if (data.name === "") {
    return NextResponse.json({ error: "שם נדרש" }, { status: 400 });
  }
  if (data.phone === "") {
    return NextResponse.json({ error: "טלפון נדרש" }, { status: 400 });
  }

  const row = await prisma.topicProfessional.update({
    where: { id: professionalId },
    data,
  });

  return NextResponse.json({
    professional: {
      id: row.id,
      name: row.name,
      role: row.role,
      phone: row.phone,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; professionalId: string }> },
) {
  const { session, response } = await requireUser();
  if (!session) return response!;
  const { id: topicId, professionalId } = await ctx.params;

  if (!(await isTopicMember(topicId, session.userId))) {
    return NextResponse.json({ error: "אין גישה לנושא" }, { status: 403 });
  }

  const existing = await prisma.topicProfessional.findFirst({
    where: { id: professionalId, topicId },
  });
  if (!existing) {
    return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
  }

  await prisma.topicProfessional.delete({ where: { id: professionalId } });
  return NextResponse.json({ ok: true });
}
