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

  const rows = await prisma.topicShoppingItem.findMany({
    where: { topicId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ items: rows.map(mapItem) });
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

  let body: { title?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "גוף בקשה לא תקין" }, { status: 400 });
  }

  const title = String(body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "פריט נדרש" }, { status: 400 });
  }

  const agg = await prisma.topicShoppingItem.aggregate({
    where: { topicId },
    _max: { position: true },
  });
  const position = (agg._max.position ?? -1) + 1;

  const row = await prisma.topicShoppingItem.create({
    data: { topicId, title, position },
  });

  return NextResponse.json({ item: mapItem(row) });
}
