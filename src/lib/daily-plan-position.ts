import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient;

/**
 * אינדקס הכנסה לשורה עם שעה: לפני השורה המתוזמנת הראשונה עם שעה גבוהה יותר.
 * שורות ללא שעה לא משפיעות על האינדקס — רק משווים מול timeMin שאינו null.
 */
export function findInsertIndexForTimed(
  rows: { id: string; timeMin: number | null }[],
  timeMin: number,
): number {
  for (let i = 0; i < rows.length; i++) {
    const t = rows[i].timeMin;
    if (t != null && t > timeMin) return i;
  }
  return rows.length;
}

/** מעדכן position דחוס 0…n−1 לפי סדר המזהים */
export async function applyDayOrder(tx: Tx, orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await tx.dailyPlanItem.update({
      where: { id: orderedIds[i] },
      data: { position: i },
    });
  }
}

export async function compactDayPositions(tx: Tx, userId: string, day: Date): Promise<void> {
  const rows = await tx.dailyPlanItem.findMany({
    where: { userId, day },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  await applyDayOrder(
    tx,
    rows.map((r) => r.id),
  );
}

/** מעביר שורה לסוף היום ומגדיר timeMin ל-null */
export async function moveItemToEndNoTime(userId: string, itemId: string): Promise<void> {
  const item = await prisma.dailyPlanItem.findFirst({
    where: { id: itemId, userId },
  });
  if (!item) return;

  await prisma.$transaction(async (tx) => {
    const rows = await tx.dailyPlanItem.findMany({
      where: { userId, day: item.day },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
    const ids = rows.map((r) => r.id).filter((id) => id !== itemId);
    const newOrder = [...ids, itemId];
    await applyDayOrder(tx, newOrder);
    await tx.dailyPlanItem.update({
      where: { id: itemId },
      data: { timeMin: null },
    });
  });
}

/** מעדכן שעה וממקם את השורה לפי סדר השעות (מול שורות מתוזמנות בלבד; ללא שעה לא מזיזים) */
export async function repositionItemWithTime(
  userId: string,
  itemId: string,
  newTimeMin: number,
): Promise<void> {
  const item = await prisma.dailyPlanItem.findFirst({
    where: { id: itemId, userId },
  });
  if (!item) return;
  if (item.timeMin === newTimeMin) return;

  await prisma.$transaction(async (tx) => {
    const rows = await tx.dailyPlanItem.findMany({
      where: { userId, day: item.day },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
    const others = rows.filter((r) => r.id !== itemId);
    const insertIdx = findInsertIndexForTimed(others, newTimeMin);
    const newOrder = [
      ...others.slice(0, insertIdx).map((r) => r.id),
      itemId,
      ...others.slice(insertIdx).map((r) => r.id),
    ];
    await applyDayOrder(tx, newOrder);
    await tx.dailyPlanItem.update({
      where: { id: itemId },
      data: { timeMin: newTimeMin },
    });
  });
}
