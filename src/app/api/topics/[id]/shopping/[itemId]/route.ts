import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { isTopicMember } from "@/lib/topic-access";

function mapItem(i: {
  id: string;
  title: string;
  done: boolean;
  position: number;
  createdAt: Date;
}) {
  return {
    id: i.id,
    title: i.title,
    done: i.done,
    position: i.position,
    createdAt: i.createdAt.toISOString(),
  };
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; itemId: string }> },
) {
  const { session, response } = await requireUser();
  if (!session) return response!;
  const { id: topicId, itemId } = await ctx.params;

  if (!(await isTopicMember(topicId, session.userId))) {
    return NextResponse.json({ error: "אין גישה לנושא" }, { status: 403 });
  }

  const existing = await prisma.topicShoppingItem.findFirst({
    where: { id: itemId, topicId },
  });
  if (!existing) {
    return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
  }

  let body: { title?: unknown; done?: unknown; position?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "גוף בקשה לא תקין" }, { status: 400 });
  }

  const data: { title?: string; done?: boolean; position?: number } = {};
  if (body.title !== undefined) {
    const t = String(body.title).trim();
    if (!t) return NextResponse.json({ error: "פריט נדרש" }, { status: 400 });
    data.title = t;
  }
  if (body.done !== undefined) data.done = Boolean(body.done);
  if (body.position !== undefined) {
    const n = Number(body.position);
    if (!Number.isFinite(n)) {
      return NextResponse.json({ error: "מיקום לא תקין" }, { status: 400 });
    }
    data.position = Math.round(n);
  }

  const row = await prisma.topicShoppingItem.update({
    where: { id: itemId },
    data,
  });

  return NextResponse.json({ item: mapItem(row) });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; itemId: string }> },
) {
  const { session, response } = await requireUser();
  if (!session) return response!;
  const { id: topicId, itemId } = await ctx.params;

  if (!(await isTopicMember(topicId, session.userId))) {
    return NextResponse.json({ error: "אין גישה לנושא" }, { status: 403 });
  }

  const existing = await prisma.topicShoppingItem.findFirst({
    where: { id: itemId, topicId },
  });
  if (!existing) {
    return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
  }

  await prisma.topicShoppingItem.delete({ where: { id: itemId } });
  return NextResponse.json({ ok: true });
}
