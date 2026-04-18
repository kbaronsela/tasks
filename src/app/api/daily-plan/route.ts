import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function ymdToUtcDate(ymd: string): Date | null {
  if (!DATE_RE.test(ymd)) return null;
  return new Date(`${ymd}T00:00:00.000Z`);
}

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

export async function GET(req: NextRequest) {
  const { session, response } = await requireUser();
  if (!session) return response!;

  const dateParam = req.nextUrl.searchParams.get("date")?.trim() ?? "";
  const day = ymdToUtcDate(dateParam);
  if (!day) {
    return NextResponse.json({ error: "נדרש פרמטר date בפורמט YYYY-MM-DD" }, { status: 400 });
  }

  const rows = await prisma.dailyPlanItem.findMany({
    where: { userId: session.userId, day },
    orderBy: [{ timeMin: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ items: rows.map(jsonItem) });
}

export async function POST(req: NextRequest) {
  const { session, response } = await requireUser();
  if (!session) return response!;

  let body: { date?: string; timeMin?: number; label?: string };
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

  const timeMin = Number(body.timeMin);
  if (!Number.isInteger(timeMin) || timeMin < 0 || timeMin > 1439) {
    return NextResponse.json({ error: "שעה לא תקינה" }, { status: 400 });
  }

  const label = String(body.label ?? "").trim();
  if (!label) {
    return NextResponse.json({ error: "נדרש תיאור לפעולה" }, { status: 400 });
  }

  const row = await prisma.dailyPlanItem.create({
    data: {
      userId: session.userId,
      day,
      timeMin,
      label: label.slice(0, 500),
      note: null,
    },
  });

  return NextResponse.json({ item: jsonItem(row) });
}
