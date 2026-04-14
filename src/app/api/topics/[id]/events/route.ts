import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { isTopicMember } from "@/lib/topic-access";

function mapEvent(e: {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  allDay: boolean;
  location: string | null;
  createdAt: Date;
}) {
  return {
    id: e.id,
    title: e.title,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt?.toISOString() ?? null,
    allDay: e.allDay,
    location: e.location,
    createdAt: e.createdAt.toISOString(),
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

  const rows = await prisma.topicEvent.findMany({
    where: { topicId },
    orderBy: [{ startsAt: "asc" }],
  });

  return NextResponse.json({ events: rows.map(mapEvent) });
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

  let body: {
    title?: unknown;
    startsAt?: unknown;
    endsAt?: unknown;
    allDay?: unknown;
    location?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "גוף בקשה לא תקין" }, { status: 400 });
  }

  const title = String(body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "כותרת נדרשת" }, { status: 400 });
  }

  const startsAt = new Date(String(body.startsAt ?? ""));
  if (Number.isNaN(startsAt.getTime())) {
    return NextResponse.json({ error: "תאריך התחלה לא תקין" }, { status: 400 });
  }

  let endsAt: Date | null = null;
  if (body.endsAt != null && String(body.endsAt).trim()) {
    const e = new Date(String(body.endsAt));
    if (!Number.isNaN(e.getTime())) endsAt = e;
  }

  const allDay = Boolean(body.allDay);
  const location = body.location != null ? String(body.location).trim() || null : null;

  const row = await prisma.topicEvent.create({
    data: {
      topicId,
      title,
      startsAt,
      endsAt,
      allDay,
      location,
    },
  });

  return NextResponse.json({ event: mapEvent(row) });
}
