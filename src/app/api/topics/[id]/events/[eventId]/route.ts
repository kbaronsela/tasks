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

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; eventId: string }> },
) {
  const { session, response } = await requireUser();
  if (!session) return response!;
  const { id: topicId, eventId } = await ctx.params;

  if (!(await isTopicMember(topicId, session.userId))) {
    return NextResponse.json({ error: "אין גישה לנושא" }, { status: 403 });
  }

  const existing = await prisma.topicEvent.findFirst({
    where: { id: eventId, topicId },
  });
  if (!existing) {
    return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
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

  const data: {
    title?: string;
    startsAt?: Date;
    endsAt?: Date | null;
    allDay?: boolean;
    location?: string | null;
  } = {};

  if (body.title !== undefined) {
    const t = String(body.title).trim();
    if (!t) return NextResponse.json({ error: "כותרת נדרשת" }, { status: 400 });
    data.title = t;
  }
  if (body.startsAt !== undefined) {
    const d = new Date(String(body.startsAt));
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "תאריך התחלה לא תקין" }, { status: 400 });
    }
    data.startsAt = d;
  }
  if (body.endsAt !== undefined) {
    if (body.endsAt === null || !String(body.endsAt).trim()) {
      data.endsAt = null;
    } else {
      const e = new Date(String(body.endsAt));
      if (Number.isNaN(e.getTime())) {
        return NextResponse.json({ error: "תאריך סיום לא תקין" }, { status: 400 });
      }
      data.endsAt = e;
    }
  }
  if (body.allDay !== undefined) data.allDay = Boolean(body.allDay);
  if (body.location !== undefined) {
    data.location = String(body.location).trim() || null;
  }

  const row = await prisma.topicEvent.update({
    where: { id: eventId },
    data,
  });

  return NextResponse.json({ event: mapEvent(row) });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; eventId: string }> },
) {
  const { session, response } = await requireUser();
  if (!session) return response!;
  const { id: topicId, eventId } = await ctx.params;

  if (!(await isTopicMember(topicId, session.userId))) {
    return NextResponse.json({ error: "אין גישה לנושא" }, { status: 403 });
  }

  const existing = await prisma.topicEvent.findFirst({
    where: { id: eventId, topicId },
  });
  if (!existing) {
    return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
  }

  await prisma.topicEvent.delete({ where: { id: eventId } });
  return NextResponse.json({ ok: true });
}
