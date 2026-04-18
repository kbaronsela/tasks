import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { wouldCreateDependencyCycle } from "@/lib/dependency-graph";
import { toTaskApiJson } from "@/lib/task-api-map";
import { syncTaskToDailyPlan } from "@/lib/task-daily-plan-sync";

function parseDate(s: string | null): Date | null {
  if (s === null || s === "") return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function canAccessTask(userId: string, taskId: string) {
  const row = await prisma.taskUser.findUnique({
    where: { taskId_userId: { taskId, userId } },
  });
  return !!row;
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireUser();
  if (!session) return response!;

  const { id } = await ctx.params;
  if (!(await canAccessTask(session.userId, id))) {
    return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
  }

  let body: {
    title?: string;
    description?: string | null;
    topicId?: string | null;
    scheduledAt?: string | null;
    dueAt?: string | null;
    done?: boolean;
    userIds?: string[];
    dependsOnTaskIds?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "גוף בקשה לא תקין" }, { status: 400 });
  }

  const existing = await prisma.task.findUniqueOrThrow({ where: { id } });

  if (body.topicId !== undefined) {
    let topicId: string | null = body.topicId;
    if (topicId) {
      const t = await prisma.topic.findFirst({
        where: { id: topicId, users: { some: { userId: session.userId } } },
      });
      if (!t) return NextResponse.json({ error: "נושא לא נמצא או אין הרשאה" }, { status: 400 });
    }
  }

  if (body.userIds !== undefined) {
    const userIds = [...new Set((body.userIds as string[]).filter(Boolean))];
    if (userIds.length === 0) {
      return NextResponse.json({ error: "נדרש לפחות משתמש משויך אחד" }, { status: 400 });
    }
    const effectiveTopicId =
      body.topicId !== undefined ? body.topicId : existing.topicId;
    if (effectiveTopicId) {
      const members = await prisma.topicUser.findMany({
        where: { topicId: effectiveTopicId },
        select: { userId: true },
      });
      const allowed = new Set(members.map((m) => m.userId));
      for (const uid of userIds) {
        if (!allowed.has(uid)) {
          return NextResponse.json({ error: "ניתן לשייך רק משתמשים המשויכים לנושא" }, { status: 400 });
        }
      }
    }
    await prisma.$transaction([
      prisma.taskUser.deleteMany({ where: { taskId: id } }),
      prisma.taskUser.createMany({
        data: userIds.map((userId) => ({ taskId: id, userId })),
      }),
    ]);
  }

  if (body.dependsOnTaskIds !== undefined) {
    const dependsOnTaskIds = [...new Set((body.dependsOnTaskIds as string[]).filter(Boolean))];
    for (const prereq of dependsOnTaskIds) {
      if (prereq === id) {
        return NextResponse.json({ error: "מטלה לא יכולה להיות תלויה בעצמה" }, { status: 400 });
      }
      const canSee = await prisma.task.findFirst({
        where: { id: prereq, users: { some: { userId: session.userId } } },
      });
      if (!canSee) {
        return NextResponse.json({ error: "תלות לא חוקית" }, { status: 400 });
      }
      if (await wouldCreateDependencyCycle(id, prereq)) {
        return NextResponse.json({ error: "תלות יוצרת מעגל" }, { status: 400 });
      }
    }
    await prisma.taskDependency.deleteMany({ where: { taskId: id } });
    if (dependsOnTaskIds.length) {
      await prisma.taskDependency.createMany({
        data: dependsOnTaskIds.map((dependsOnTaskId) => ({
          taskId: id,
          dependsOnTaskId,
        })),
      });
    }
  }

  const data: {
    title?: string;
    description?: string | null;
    topicId?: string | null;
    scheduledAt?: Date | null;
    dueAt?: Date | null;
    done?: boolean;
    doneAt?: Date | null;
  } = {};

  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) return NextResponse.json({ error: "כותרת ריקה" }, { status: 400 });
    data.title = title;
  }
  if (body.description !== undefined) data.description = body.description ? String(body.description) : null;
  if (body.topicId !== undefined) data.topicId = body.topicId;
  if (body.scheduledAt !== undefined) data.scheduledAt = parseDate(body.scheduledAt);
  if (body.dueAt !== undefined) data.dueAt = parseDate(body.dueAt);
  if (body.done !== undefined) {
    data.done = body.done;
    if (body.done && !existing.done) data.doneAt = new Date();
    else if (!body.done) data.doneAt = null;
  }

  if (Object.keys(data).length) {
    await prisma.task.update({ where: { id }, data });
  }

  const full = await prisma.task.findUniqueOrThrow({
    where: { id },
    include: {
      topic: { select: { id: true, title: true, color: true } },
      users: { include: { user: { select: { id: true, name: true, email: true } } } },
      dependsOn: { include: { dependsOn: { select: { id: true, title: true, done: true } } } },
    },
  });

  await syncTaskToDailyPlan(session.userId, {
    id: full.id,
    title: full.title,
    scheduledAt: full.scheduledAt,
  });

  return NextResponse.json({
    task: toTaskApiJson(full, session.userId),
  });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireUser();
  if (!session) return response!;

  const { id } = await ctx.params;
  if (!(await canAccessTask(session.userId, id))) {
    return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
  }

  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
