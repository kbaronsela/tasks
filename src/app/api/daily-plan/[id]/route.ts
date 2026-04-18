import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { compactDayPositions, moveItemToEndNoTime, repositionItemWithTime } from "@/lib/daily-plan-position";

function jsonItem(row: {
  id: string;
  day: Date;
  timeMin: number | null;
  label: string;
  done: boolean;
  createdAt: Date;
}) {
  const y = row.day.getUTCFullYear();
  const m = String(row.day.getUTCMonth() + 1).padStart(2, "0");
  const d = String(row.day.getUTCDate()).padStart(2, "0");
  return {
    id: row.id,
    date: `${y}-${m}-${d}`,
    timeMin: row.timeMin,
    label: row.label,
    done: row.done,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { session, response } = await requireUser();
  if (!session) return response!;

  const { id } = await ctx.params;

  let body: {
    timeMin?: number | null;
    label?: string;
    done?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "גוף בקשה לא תקין" }, { status: 400 });
  }

  const existing = await prisma.dailyPlanItem.findFirst({
    where: { id, userId: session.userId },
  });
  if (!existing) {
    return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
  }

  const hasTime = body.timeMin !== undefined;
  const hasLabel = body.label !== undefined;
  const hasDone = body.done !== undefined;
  if (!hasTime && !hasLabel && !hasDone) {
    return NextResponse.json({ error: "אין שדות לעדכון" }, { status: 400 });
  }

  if (hasTime) {
    if (body.timeMin === null) {
      await moveItemToEndNoTime(session.userId, id);
    } else {
      const t = Number(body.timeMin);
      if (!Number.isInteger(t) || t < 0 || t > 1439) {
        return NextResponse.json({ error: "שעה לא תקינה" }, { status: 400 });
      }
      await repositionItemWithTime(session.userId, id, t);
    }
  }

  const data: {
    label?: string;
    note?: null;
    done?: boolean;
  } = {};

  if (hasLabel) {
    const label = String(body.label).trim();
    if (!label) {
      return NextResponse.json({ error: "תיאור ריק" }, { status: 400 });
    }
    data.label = label.slice(0, 500);
    data.note = null;
  }

  if (hasDone) {
    data.done = Boolean(body.done);
  }

  if (Object.keys(data).length > 0) {
    await prisma.dailyPlanItem.update({
      where: { id },
      data,
    });
  }

  const row = await prisma.dailyPlanItem.findFirstOrThrow({
    where: { id, userId: session.userId },
  });

  return NextResponse.json({ item: jsonItem(row) });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { session, response } = await requireUser();
  if (!session) return response!;

  const { id } = await ctx.params;

  const existing = await prisma.dailyPlanItem.findFirst({
    where: { id, userId: session.userId },
  });
  if (!existing) {
    return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.dailyPlanItem.delete({ where: { id } });
    await compactDayPositions(tx, session.userId, existing.day);
  });

  return NextResponse.json({ ok: true });
}
