import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { normalizeDailyPlanLabel } from "@/lib/daily-plan-templates";

export async function POST(req: NextRequest) {
  const { session, response } = await requireUser();
  if (!session) return response!;

  let body: { label?: string; timeMin?: number | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "גוף בקשה לא תקין" }, { status: 400 });
  }

  const label = normalizeDailyPlanLabel(String(body.label ?? ""));
  if (!label) {
    return NextResponse.json({ error: "נדרש תיאור" }, { status: 400 });
  }

  let timeMin: number | null = null;
  const raw = body.timeMin;
  if (raw !== undefined && raw !== null) {
    const t = Number(raw);
    if (!Number.isInteger(t) || t < 0 || t > 1439) {
      return NextResponse.json({ error: "שעה לא תקינה" }, { status: 400 });
    }
    timeMin = t;
  }

  await prisma.dailyPlanPinnedTemplate.upsert({
    where: {
      userId_label: { userId: session.userId, label },
    },
    create: { userId: session.userId, label, timeMin },
    update: { timeMin },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { session, response } = await requireUser();
  if (!session) return response!;

  const raw = req.nextUrl.searchParams.get("label") ?? "";
  const label = normalizeDailyPlanLabel(decodeURIComponent(raw));
  if (!label) {
    return NextResponse.json({ error: "נדרש תיאור" }, { status: 400 });
  }

  await prisma.dailyPlanPinnedTemplate.deleteMany({
    where: { userId: session.userId, label },
  });

  return NextResponse.json({ ok: true });
}
