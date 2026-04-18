import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { normalizeDailyPlanLabel } from "@/lib/daily-plan-templates";

/** הסתרת פעילות מההצעות האוטומטיות */
export async function POST(req: NextRequest) {
  const { session, response } = await requireUser();
  if (!session) return response!;

  let body: { label?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "גוף בקשה לא תקין" }, { status: 400 });
  }

  const label = normalizeDailyPlanLabel(String(body.label ?? ""));
  if (!label) {
    return NextResponse.json({ error: "נדרש תיאור" }, { status: 400 });
  }

  await prisma.dailyPlanHiddenLabel.upsert({
    where: {
      userId_label: { userId: session.userId, label },
    },
    create: { userId: session.userId, label },
    update: {},
  });

  return NextResponse.json({ ok: true });
}

/** ביטול הסתרה */
export async function DELETE(req: NextRequest) {
  const { session, response } = await requireUser();
  if (!session) return response!;

  const raw = req.nextUrl.searchParams.get("label") ?? "";
  const label = normalizeDailyPlanLabel(decodeURIComponent(raw));
  if (!label) {
    return NextResponse.json({ error: "נדרש תיאור" }, { status: 400 });
  }

  await prisma.dailyPlanHiddenLabel.deleteMany({
    where: { userId: session.userId, label },
  });

  return NextResponse.json({ ok: true });
}
