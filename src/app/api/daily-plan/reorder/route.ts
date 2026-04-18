import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { applyDayOrder } from "@/lib/daily-plan-position";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function ymdToUtcDate(ymd: string): Date | null {
  if (!DATE_RE.test(ymd)) return null;
  return new Date(`${ymd}T00:00:00.000Z`);
}

export async function POST(req: NextRequest) {
  const { session, response } = await requireUser();
  if (!session) return response!;

  let body: { date?: string; orderedIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "גוף בקשה לא תקין" }, { status: 400 });
  }

  const dateParam = String(body.date ?? "").trim();
  const day = ymdToUtcDate(dateParam);
  if (!day) {
    return NextResponse.json({ error: "תאריך לא תקין (YYYY-MM-DD)" }, { status: 400 });
  }

  const orderedIds = Array.isArray(body.orderedIds)
    ? body.orderedIds.filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];
  if (orderedIds.length === 0) {
    return NextResponse.json({ error: "רשימה ריקה" }, { status: 400 });
  }
  if (new Set(orderedIds).size !== orderedIds.length) {
    return NextResponse.json({ error: "רשימת סדר לא תקינה" }, { status: 400 });
  }

  const existing = await prisma.dailyPlanItem.findMany({
    where: { userId: session.userId, day },
    select: { id: true },
  });
  const idSet = new Set(existing.map((r) => r.id));
  if (existing.length !== orderedIds.length || orderedIds.some((id) => !idSet.has(id))) {
    return NextResponse.json({ error: "רשימת סדר לא תואמת ליום" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await applyDayOrder(tx, orderedIds);
  });

  return NextResponse.json({ ok: true });
}
