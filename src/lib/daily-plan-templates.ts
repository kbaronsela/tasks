/** איחוד רווחים וטרים — לזיהוי ייחודי של שם פעילות */
export function normalizeDailyPlanLabel(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}
