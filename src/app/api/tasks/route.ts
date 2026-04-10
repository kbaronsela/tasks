import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { wouldCreateDependencyCycle } from "@/lib/dependency-graph";
import { toTaskApiJson, type TaskApiInclude } from "@/lib/task-api-map";

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** סינון לפי YYYY-MM-DD: מטלה שמועד לביצוע או לביצוע עד נופלים בטווח (כולל) */
function buildDateRangeWhere(
  dateFrom: string | null,
  dateTo: string | null,
): { OR: ({ scheduledAt: object } | { dueAt: object })[] } | undefined {
  const fp = dateFrom?.trim() || "";
  const tp = dateTo?.trim() || "";
  if (!fp && !tp) return undefined;
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;

  let start: Date | undefined;
  let end: Date | undefined;
  if (fp && dateRe.test(fp)) {
    start = new Date(`${fp}T00:00:00.000Z`);
  }
  if (tp && dateRe.test(tp)) {
    end = new Date(`${tp}T23:59:59.999Z`);
  }
  if (start && end && start > end) {
    start = new Date(`${tp}T00:00:00.000Z`);
    end = new Date(`${fp}T23:59:59.999Z`);
  }

  if (start && end) {
    return {
      OR: [
        { scheduledAt: { gte: start, lte: end } },
        { dueAt: { gte: start, lte: end } },
      ],
    };
  }
  if (start) {
    return {
      OR: [{ scheduledAt: { gte: start } }, { dueAt: { gte: start } }],
    };
  }
  if (end) {
    return {
      OR: [{ scheduledAt: { lte: end } }, { dueAt: { lte: end } }],
    };
  }
  return undefined;
}

/** למיון: התאריך המוקדם מבין מועד לביצוע לדד־ליין; אם אחד בלבד — הוא */
function effectiveSortMs(task: { scheduledAt: Date | null; dueAt: Date | null }): number | null {
  const s = task.scheduledAt?.getTime();
  const d = task.dueAt?.getTime();
  if (s != null && d != null) return Math.min(s, d);
  if (d != null) return d;
  if (s != null) return s;
  return null;
}

/** מטלות פתוחות קודם, אחריהן מטלות שבוצעו; בכל קבוצה — לפי מועדים */
function sortTasksForDisplay<
  T extends { done: boolean; scheduledAt: Date | null; dueAt: Date | null; createdAt: Date },
>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const ka = effectiveSortMs(a);
    const kb = effectiveSortMs(b);
    if (ka == null && kb == null) return b.createdAt.getTime() - a.createdAt.getTime();
    if (ka == null) return 1;
    if (kb == null) return -1;
    if (ka !== kb) return ka - kb;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

export async function GET(req: NextRequest) {
  const { session, response } = await requireUser();
  if (!session) return response!;

  const topicFilter = req.nextUrl.searchParams.get("topic") ?? "all";
  const showCompleted =
    req.nextUrl.searchParams.get("showCompleted") === "1" ||
    req.nextUrl.searchParams.get("showCompleted") === "true";
  const dateRangeWhere = buildDateRangeWhere(
    req.nextUrl.searchParams.get("dateFrom"),
    req.nextUrl.searchParams.get("dateTo"),
  );

  const doneWhere = showCompleted ? {} : { done: false };
  const include: TaskApiInclude = {
    topic: { select: { id: true, title: true, color: true } },
    users: { include: { user: { select: { id: true, name: true, email: true } } } },
    dependsOn: { include: { dependsOn: { select: { id: true, title: true, done: true } } } },
  };

  const isSpecificTopic =
    topicFilter !== "all" && topicFilter !== "none" && topicFilter.length > 0;

  if (isSpecificTopic) {
    const access = await prisma.topicUser.findUnique({
      where: {
        topicId_userId: { topicId: topicFilter, userId: session.userId },
      },
    });
    if (!access) {
      return NextResponse.json({ error: "אין גישה לנושא" }, { status: 403 });
    }

    const topicBranch = {
      ...doneWhere,
      OR: [
        { topicId: topicFilter },
        {
          topicId: null,
          users: { some: { userId: session.userId } },
        },
      ],
    };

    const raw = await prisma.task.findMany({
      where: dateRangeWhere ? { AND: [topicBranch, dateRangeWhere] } : topicBranch,
      include,
    });

    const tasks = sortTasksForDisplay(raw);
    return NextResponse.json({
      tasks: tasks.map((t) => toTaskApiJson(t, session.userId)),
    });
  }

  const baseWhere = {
    users: { some: { userId: session.userId } },
  };

  let topicWhere: Record<string, unknown> = {};
  if (topicFilter === "none") {
    topicWhere = { topicId: null };
  }

  const listWhere = { ...baseWhere, ...topicWhere, ...doneWhere };

  const raw = await prisma.task.findMany({
    where: dateRangeWhere ? { AND: [listWhere, dateRangeWhere] } : listWhere,
    include,
  });

  const tasks = sortTasksForDisplay(raw);

  return NextResponse.json({
    tasks: tasks.map((t) => toTaskApiJson(t, session.userId)),
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
      topic: { select: { id: true, title: true, color: true } },
      users: { include: { user: { select: { id: true, name: true, email: true } } } },
      dependsOn: { include: { dependsOn: { select: { id: true, title: true, done: true } } } },
    },
  });

  return NextResponse.json({
    task: toTaskApiJson(full, session.userId),
  });
}
