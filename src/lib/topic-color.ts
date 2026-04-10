/** פלטה קבועה — צבעים ברורים ושונים זה מזה */
export const TOPIC_AUTO_PALETTE = [
  "#6366f1",
  "#0ea5e9",
  "#14b8a6",
  "#22c55e",
  "#84cc16",
  "#ca8a04",
  "#ea580c",
  "#ef4444",
  "#db2777",
  "#a855f7",
  "#7c3aed",
  "#64748b",
] as const;

export type TopicColorFields = { id: string; color: string | null };

/** צבע תצוגה: מותאם אישית או אוטומטי לפי id (יציב) */
export function resolveTopicColor(topic: TopicColorFields): string {
  const c = topic.color?.trim();
  if (c && /^#[0-9A-Fa-f]{6}$/.test(c)) {
    return c.toLowerCase();
  }
  let hash = 0;
  for (let i = 0; i < topic.id.length; i++) {
    hash = (hash << 5) - hash + topic.id.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % TOPIC_AUTO_PALETTE.length;
  return TOPIC_AUTO_PALETTE[idx]!;
}

/** צבע טקסט קריא על רקע */
export function contrastOnBackground(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#0f172a";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const l = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
  return l > 0.55 ? "#0f172a" : "#ffffff";
}

export type ParsedTopicColor =
  | { kind: "omit" }
  | { kind: "value"; color: string | null }
  | { kind: "error"; error: string };

/** ל־API: undefined = לא לעדכן; null = אוטומטי */
export function parseTopicColorInput(value: unknown): ParsedTopicColor {
  if (value === undefined) return { kind: "omit" };
  if (value === null || value === "") return { kind: "value", color: null };
  const s = String(value).trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(s)) {
    return { kind: "error", error: "פורמט צבע לא תקין (נדרש #RRGGBB)" };
  }
  return { kind: "value", color: s.toLowerCase() };
}
