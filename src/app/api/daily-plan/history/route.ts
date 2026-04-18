import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";

/** תבניות מפעילויות קודמות — ייחודיות label+note (השעה מהמופע האחרון), ממוינות לפי שעה */
export async function GET() {
  const { session, response } = await requireUser();
  if (!session) return response!;

  const rows = await prisma.dailyPlanItem.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 400,
    select: { label: true, note: true, timeMin: true },
  });

  const seen = new Set<string>();
  const templates: { label: string; note: string | null; timeMin: number }[] = [];
  for (const r of rows) {
    const key = `${r.label}\0${r.note ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    templates.push({ label: r.label, note: r.note, timeMin: r.timeMin });
    if (templates.length >= 60) break;
  }

  templates.sort((a, b) => {
    if (a.timeMin !== b.timeMin) return a.timeMin - b.timeMin;
    return a.label.localeCompare(b.label, "he");
  });

  return NextResponse.json({ templates });
}
