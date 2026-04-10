const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** מפרק מחרוזת עם פסיקים, נקודה-פסיק, שורות חדשות או רווחים */
export function parseEmailList(raw: string): string[] {
  const parts = raw
    .split(/[\s,;]+/g)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}
