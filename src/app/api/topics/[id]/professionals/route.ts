import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { isTopicMember } from "@/lib/topic-access";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { session, response } = await requireUser();
  if (!session) return response!;
  const { id: topicId } = await ctx.params;

  if (!(await isTopicMember(topicId, session.userId))) {
    return NextResponse.json({ error: "אין גישה לנושא" }, { status: 403 });
  }

  const rows = await prisma.topicProfessional.findMany({
    where: { topicId },
    orderBy: [{ name: "asc" }],
  });

  return NextResponse.json({
    professionals: rows.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      phone: p.phone,
      notes: p.notes,
      createdAt: p.createdAt.toISOString(),
    })),
  });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { session, response } = await requireUser();
  if (!session) return response!;
  const { id: topicId } = await ctx.params;

  if (!(await isTopicMember(topicId, session.userId))) {
    return NextResponse.json({ error: "אין גישה לנושא" }, { status: 403 });
  }

  let body: { name?: unknown; role?: unknown; phone?: unknown; notes?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "גוף בקשה לא תקין" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "שם נדרש" }, { status: 400 });
  }
  if (!phone) {
    return NextResponse.json({ error: "טלפון נדרש" }, { status: 400 });
  }

  const role = body.role != null ? String(body.role).trim() || null : null;
  const notes = body.notes != null ? String(body.notes).trim() || null : null;

  const row = await prisma.topicProfessional.create({
    data: { topicId, name, phone, role, notes },
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
