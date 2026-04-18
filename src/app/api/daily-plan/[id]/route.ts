import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";

function jsonItem(row: {
  id: string;
  day: Date;
  timeMin: number;
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
    timeMin?: number;
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

  const data: {
    timeMin?: number;
    label?: string;
    note?: null;
    done?: boolean;
  } = {};

  if (body.timeMin !== undefined) {
    const t = Number(body.timeMin);
    if (!Number.isInteger(t) || t < 0 || t > 1439) {
      return NextResponse.json({ error: "שעה לא תקינה" }, { status: 400 });
    }
    data.timeMin = t;
  }

  if (body.label !== undefined) {
    const label = String(body.label).trim();
    if (!label) {
      return NextResponse.json({ error: "תיאור ריק" }, { status: 400 });
    }
    data.label = label.slice(0, 500);
  }

  if (body.done !== undefined) {
    data.done = Boolean(body.done);
  }

  if (body.timeMin !== undefined || body.label !== undefined) {
    data.note = null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "אין שדות לעדכון" }, { status: 400 });
  }

  const row = await prisma.dailyPlanItem.update({
    where: { id },
    data,
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

  await prisma.dailyPlanItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
