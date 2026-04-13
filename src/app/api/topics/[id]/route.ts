import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { parseTopicColorInput } from "@/lib/topic-color";

async function canAccessTopic(userId: string, topicId: string) {
  const row = await prisma.topicUser.findUnique({
    where: { topicId_userId: { topicId, userId } },
  });
  return !!row;
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireUser();
  if (!session) return response!;

  const { id } = await ctx.params;
  if (!(await canAccessTopic(session.userId, id))) {
    return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
  }

  let body: { title?: string; userIds?: string[]; color?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "גוף בקשה לא תקין" }, { status: 400 });
  }

  const data: { title?: string; color?: string | null } = {};
  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) return NextResponse.json({ error: "כותרת ריקה" }, { status: 400 });
    data.title = title;
  }

  if (body.color !== undefined) {
    const colorParsed = parseTopicColorInput(body.color);
    if (colorParsed.kind === "error") {
      return NextResponse.json({ error: colorParsed.error }, { status: 400 });
    }
    if (colorParsed.kind === "value") {
      data.color = colorParsed.color;
    }
  }

  if (body.userIds !== undefined) {
    const userIds = [...new Set((body.userIds as string[]).filter(Boolean))];
    if (userIds.length === 0) {
      return NextResponse.json({ error: "נדרש לפחות משתמש משויך אחד" }, { status: 400 });
    }
    await prisma.$transaction([
      prisma.topicUser.deleteMany({ where: { topicId: id } }),
      prisma.topicUser.createMany({
        data: userIds.map((userId) => ({ topicId: id, userId })),
      }),
    ]);
  }

  if (Object.keys(data).length) {
    await prisma.topic.update({ where: { id }, data });
  }

  const topic = await prisma.topic.findUniqueOrThrow({
    where: { id },
    include: {
      users: { include: { user: { select: { id: true, name: true, email: true } } } },
      _count: { select: { tasks: true } },
    },
  });

  return NextResponse.json({
    topic: {
      id: topic.id,
      title: topic.title,
      color: topic.color,
      createdAt: topic.createdAt,
      taskCount: topic._count.tasks,
      users: topic.users.map((u) => u.user),
    },
  });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireUser();
  if (!session) return response!;

  const { id } = await ctx.params;
  if (!(await canAccessTopic(session.userId, id))) {
    return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
  }

  await prisma.topic.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
