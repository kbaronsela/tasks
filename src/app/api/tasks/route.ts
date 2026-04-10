import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { wouldCreateDependencyCycle } from "@/lib/dependency-graph";

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: NextRequest) {
  const { session, response } = await requireUser();
  if (!session) return response!;

  const topicFilter = req.nextUrl.searchParams.get("topic") ?? "all";

  const baseWhere = {
    users: { some: { userId: session.userId } },
  };

  let topicWhere: Record<string, unknown> = {};
  if (topicFilter === "none") {
    topicWhere = { topicId: null };
  } else if (topicFilter !== "all" && topicFilter.length > 0) {
    topicWhere = { topicId: topicFilter };
  }

  const tasks = await prisma.task.findMany({
    where: { ...baseWhere, ...topicWhere },
    include: {
      topic: { select: { id: true, title: true } },
      users: { include: { user: { select: { id: true, name: true, email: true } } } },
      dependsOn: { include: { dependsOn: { select: { id: true, title: true, done: true } } } },
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      done: t.done,
      doneAt: t.doneAt,
      scheduledAt: t.scheduledAt,
      dueAt: t.dueAt,
      createdAt: t.createdAt,
      topic: t.topic,
      users: t.users.map((u) => u.user),
      prerequisites: t.dependsOn.map((d) => ({
        id: d.dependsOn.id,
        title: d.dependsOn.title,
        done: d.dependsOn.done,
      })),
    })),
  });
}

export async function POST(req: NextRequest) {
  const { session, response } = await requireUser();
  if (!session) return response!;

  let body: {
    title?: string;
    description?: string | null;
    topicId?: string | null;
    scheduledAt?: string | null;
    dueAt?: string | null;
    userIds?: string[];
    dependsOnTaskIds?: string[];
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

  let topicId: string | null = body.topicId ?? null;
  if (topicId) {
    const t = await prisma.topic.findFirst({
      where: { id: topicId, users: { some: { userId: session.userId } } },
    });
    if (!t) return NextResponse.json({ error: "נושא לא נמצא או אין הרשאה" }, { status: 400 });
  }

  const userIds = Array.isArray(body.userIds) ? [...new Set(body.userIds.filter(Boolean))] : [];
  if (!userIds.includes(session.userId)) userIds.push(session.userId);

  const scheduledAt = parseDate(body.scheduledAt ?? undefined);
  const dueAt = parseDate(body.dueAt ?? undefined);

  const dependsOnTaskIds = Array.isArray(body.dependsOnTaskIds)
    ? [...new Set(body.dependsOnTaskIds.filter(Boolean))]
    : [];

  for (const prereq of dependsOnTaskIds) {
    const canSee = await prisma.task.findFirst({
      where: { id: prereq, users: { some: { userId: session.userId } } },
    });
    if (!canSee) {
      return NextResponse.json({ error: "תלות לא חוקית (מטלה לא קיימת או אין גישה)" }, { status: 400 });
    }
  }

  const task = await prisma.task.create({
    data: {
      title,
      description: body.description ? String(body.description) : null,
      topicId,
      scheduledAt,
      dueAt,
      createdById: session.userId,
      users: { create: userIds.map((userId) => ({ userId })) },
    },
  });

  for (const prereq of dependsOnTaskIds) {
    if (await wouldCreateDependencyCycle(task.id, prereq)) {
      await prisma.task.delete({ where: { id: task.id } });
      return NextResponse.json({ error: "תלות יוצרת מעגל" }, { status: 400 });
    }
  }

  if (dependsOnTaskIds.length) {
    await prisma.taskDependency.createMany({
      data: dependsOnTaskIds.map((dependsOnTaskId) => ({
        taskId: task.id,
        dependsOnTaskId,
      })),
    });
  }

  const full = await prisma.task.findUniqueOrThrow({
    where: { id: task.id },
    include: {
      topic: { select: { id: true, title: true } },
      users: { include: { user: { select: { id: true, name: true, email: true } } } },
      dependsOn: { include: { dependsOn: { select: { id: true, title: true, done: true } } } },
    },
  });

  return NextResponse.json({
    task: {
      id: full.id,
      title: full.title,
      description: full.description,
      done: full.done,
      doneAt: full.doneAt,
      scheduledAt: full.scheduledAt,
      dueAt: full.dueAt,
      createdAt: full.createdAt,
      topic: full.topic,
      users: full.users.map((u) => u.user),
      prerequisites: full.dependsOn.map((d) => ({
        id: d.dependsOn.id,
        title: d.dependsOn.title,
        done: d.dependsOn.done,
      })),
    },
  });
}
