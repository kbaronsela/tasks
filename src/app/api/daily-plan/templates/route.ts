import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { normalizeDailyPlanLabel } from "@/lib/daily-plan-templates";

/** קבועות + הצעות מהיסטוריה (ללא מוסתרים וללא כפילות מול קבועות) */
export async function GET() {
  const { session, response } = await requireUser();
  if (!session) return response!;

  const pinnedRows = await prisma.dailyPlanPinnedTemplate.findMany({
    where: { userId: session.userId },
  });
  const pinned = [...pinnedRows].sort((a, b) => {
    if (a.timeMin != null && b.timeMin != null) {
      if (a.timeMin !== b.timeMin) return a.timeMin - b.timeMin;
      return a.label.localeCompare(b.label, "he");
    }
    if (a.timeMin != null) return -1;
    if (b.timeMin != null) return 1;
    return a.label.localeCompare(b.label, "he");
  });

  const hiddenRows = await prisma.dailyPlanHiddenLabel.findMany({
    where: { userId: session.userId },
    select: { label: true },
  });
  const hiddenSet = new Set(hiddenRows.map((h) => h.label));

  const pinnedLabels = new Set(pinned.map((p) => p.label));

  const rows = await prisma.dailyPlanItem.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 400,
    select: { label: true, timeMin: true },
  });

  const seen = new Set<string>();
  const suggestions: { label: string; timeMin: number | null }[] = [];
  for (const r of rows) {
    const lab = normalizeDailyPlanLabel(r.label);
    if (!lab) continue;
    if (seen.has(lab)) continue;
    seen.add(lab);
    if (hiddenSet.has(lab)) continue;
    if (pinnedLabels.has(lab)) continue;
    suggestions.push({ label: lab, timeMin: r.timeMin });
    if (suggestions.length >= 50) break;
  }

  suggestions.sort((a, b) => {
    if (a.timeMin != null && b.timeMin != null) {
      if (a.timeMin !== b.timeMin) return a.timeMin - b.timeMin;
      return a.label.localeCompare(b.label, "he");
    }
    if (a.timeMin != null) return -1;
    if (b.timeMin != null) return 1;
    return a.label.localeCompare(b.label, "he");
  });

  return NextResponse.json({
    pinned: pinned.map((p) => ({ label: p.label, timeMin: p.timeMin })),
    suggestions,
  });
}
