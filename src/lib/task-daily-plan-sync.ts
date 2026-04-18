import { prisma } from "@/lib/prisma";
import { findInsertIndexForTimed } from "@/lib/daily-plan-position";

/** אזור זמן לחילוץ יום ושעה ממועד לביצוע (מיושר לתכנון היומי) */
const SCHEDULE_TIMEZONE = "Asia/Jerusalem";

/**
 * ממיר מועד לביצוע ליום (DATE כמו ב־API של התכנון) ולדקות מהיום בזמן מקומי.
 */
export function scheduledAtToDayAndTimeMin(scheduledAt: Date): { day: Date; timeMin: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SCHEDULE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(scheduledAt);
  const get = (ty: Intl.DateTimeFormatPart["type"]) => parts.find((p) => p.type === ty)?.value;
  const y = get("year");
  const m = get("month");
  const d = get("day");
  const hour = parseInt(get("hour") ?? "0", 10);
  const minute = parseInt(get("minute") ?? "0", 10);
  const ymd = `${y}-${m}-${d}`;
  const day = new Date(`${ymd}T00:00:00.000Z`);
  const timeMin = hour * 60 + minute;
  return { day, timeMin };
}

type TaskSyncFields = {
  id: string;
  title: string;
  scheduledAt: Date | null;
};

/**
 * מסנכרן שורת תכנון יומי למשתמש המחובר לפי מטלה (מועד לביצוע).
 * בלי מועד — מוחק שורה מקושרת אם הייתה.
 */
export async function syncTaskToDailyPlan(userId: string, task: TaskSyncFields): Promise<void> {
  if (!task.scheduledAt) {
    await prisma.dailyPlanItem.deleteMany({
      where: { userId, taskId: task.id },
    });
    return;
  }

  const { day, timeMin } = scheduledAtToDayAndTimeMin(task.scheduledAt);

  await prisma.$transaction(async (tx) => {
    await tx.dailyPlanItem.deleteMany({
      where: { userId, taskId: task.id },
    });

    const rows = await tx.dailyPlanItem.findMany({
      where: { userId, day },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true, timeMin: true },
    });
    const insertPos = findInsertIndexForTimed(rows, timeMin);

    await tx.dailyPlanItem.updateMany({
      where: { userId, day, position: { gte: insertPos } },
      data: { position: { increment: 1 } },
    });

    await tx.dailyPlanItem.create({
      data: {
        userId,
        taskId: task.id,
        day,
        timeMin,
        position: insertPos,
        label: task.title.slice(0, 500),
        note: null,
        done: false,
      },
    });
  });
}
