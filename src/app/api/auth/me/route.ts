import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null });
  }

  const u = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true, name: true, defaultFocusTopicId: true },
  });

  return NextResponse.json({
    user: {
      id: session.userId,
      email: u?.email ?? session.email,
      name: u?.name ?? session.name,
      defaultFocusTopicId: u?.defaultFocusTopicId ?? null,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "גוף בקשה לא תקין" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "גוף בקשה לא תקין" }, { status: 400 });
  }

  const raw = (body as { defaultFocusTopicId?: unknown }).defaultFocusTopicId;

  let nextTopicId: string | null | undefined;
  if (raw === null || raw === "") {
    nextTopicId = null;
  } else if (typeof raw === "string" && raw.trim()) {
    nextTopicId = raw.trim();
  } else if (raw !== undefined) {
    return NextResponse.json({ error: "מזהה נושא לא תקין" }, { status: 400 });
  }

  if (nextTopicId !== undefined) {
    if (nextTopicId !== null) {
      const member = await prisma.topicUser.findUnique({
        where: { topicId_userId: { topicId: nextTopicId, userId: session.userId } },
      });
      if (!member) {
        return NextResponse.json({ error: "אין גישה לנושא" }, { status: 400 });
      }
    }

    await prisma.user.update({
      where: { id: session.userId },
      data: { defaultFocusTopicId: nextTopicId },
    });
  }

  return GET();
}
