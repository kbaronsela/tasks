import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";

/** תבניות מפעילויות קודמות — ייחודיות לפי label (השעה מהמופע האחרון), ממוינות לפי שעה */
export async function GET() {
  const { session, response } = await requireUser();
  if (!session) return response!;

  const rows = await prisma.dailyPlanItem.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 400,
    select: { label: true, timeMin: true },
  });

  const seen = new Set<string>();
  const templates: { label: string; timeMin: number }[] = [];
  for (const r of rows) {
    if (seen.has(r.label)) continue;
    seen.add(r.label);
    templates.push({ label: r.label, timeMin: r.timeMin });
    if (templates.length >= 60) break;
  }

  templates.sort((a, b) => {
    if (a.timeMin !== b.timeMin) return a.timeMin - b.timeMin;
    return a.label.localeCompare(b.label, "he");
  });

  return NextResponse.json({ templates });
}
