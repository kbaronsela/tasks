import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { parseTopicColorInput } from "@/lib/topic-color";

export async function GET() {
  const { session, response } = await requireUser();
  if (!session) return response!;

  const topics = await prisma.topic.findMany({
    where: {
      users: { some: { userId: session.userId } },
    },
    include: {
      users: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      _count: { select: { tasks: true } },
    },
  });

  const mapped = topics.map((t) => ({
    id: t.id,
    title: t.title,
    color: t.color,
    createdAt: t.createdAt,
    taskCount: t._count.tasks,
    users: t.users.map((u) => u.user),
  }));

  mapped.sort((a, b) => a.title.localeCompare(b.title, "he", { sensitivity: "base" }));

  return NextResponse.json({ topics: mapped });
}

export async function POST(req: NextRequest) {
  const { session, response } = await requireUser();
  if (!session) return response!;

  let body: { title?: string; userIds?: string[]; color?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "גוף בקשה לא תקין" }, { status: 400 });
  }

  const title = String(body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "כותרת נדרשת" }, { status: 400 });
  }

  let colorValue: string | null = null;
  const colorParsed = parseTopicColorInput(body.color);
  if (colorParsed.kind === "error") {
    return NextResponse.json({ error: colorParsed.error }, { status: 400 });
  }
  if (colorParsed.kind === "value") {
    colorValue = colorParsed.color;
  }

  const userIds = Array.isArray(body.userIds) ? [...new Set(body.userIds.filter(Boolean))] : [];
  if (!userIds.includes(session.userId)) userIds.push(session.userId);

  const topic = await prisma.topic.create({
    data: {
      title,
      color: colorValue,
      createdById: session.userId,
      users: {
        create: userIds.map((userId) => ({ userId })),
      },
    },
    include: {
      users: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });

  return NextResponse.json({
    topic: {
      id: topic.id,
      title: topic.title,
      color: topic.color,
      createdAt: topic.createdAt,
      taskCount: 0,
      users: topic.users.map((u) => u.user),
    },
  });
}
