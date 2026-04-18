import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";

/** תבניות מפעילויות קודמות — לפי ייחודיות label+note, מהחדש לישן */
export async function GET() {
  const { session, response } = await requireUser();
  if (!session) return response!;

  const rows = await prisma.dailyPlanItem.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 400,
    select: { label: true, note: true },
  });

  const seen = new Set<string>();
  const templates: { label: string; note: string | null }[] = [];
  for (const r of rows) {
    const key = `${r.label}\0${r.note ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    templates.push({ label: r.label, note: r.note });
    if (templates.length >= 60) break;
  }

  return NextResponse.json({ templates });
}
