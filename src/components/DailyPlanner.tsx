"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type User = { id: string; name: string; email: string };

type PlanItem = {
  id: string;
  date: string;
  timeMin: number;
  label: string;
  note: string | null;
  done: boolean;
  createdAt: string;
};

type Template = { label: string; note: string | null; timeMin: number };

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function minutesToHHMM(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function hhmmToMinutes(s: string): number | null {
  const t = s.trim();
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(t);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const min = parseInt(match[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function shiftYmd(ymd: string, deltaDays: number): string {
  const [y, mo, d] = ymd.split("-").map(Number);
  const dt = new Date(y, mo - 1, d + deltaDays);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function ModalCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute left-0 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      aria-label="סגור"
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  );
}

export function DailyPlanner({ user }: { user: User }) {
  const router = useRouter();
  const [dateYmd, setDateYmd] = useState(todayYmd);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [fromPast, setFromPast] = useState(false);
  const [templateIndex, setTemplateIndex] = useState("");
  const [formTime, setFormTime] = useState("09:00");
  const [formLabel, setFormLabel] = useState("");
  const [formNote, setFormNote] = useState("");

  const loadItems = useCallback(async () => {
    const r = await fetch(`/api/daily-plan?date=${encodeURIComponent(dateYmd)}`);
    if (!r.ok) throw new Error("טעינת התכנון נכשלה");
    const data = await r.json();
    setItems(data.items as PlanItem[]);
  }, [dateYmd]);

  const loadTemplates = useCallback(async () => {
    const r = await fetch("/api/daily-plan/history");
    if (!r.ok) return;
    const data = await r.json();
    setTemplates((data.templates as Template[]) ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await loadItems();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "שגיאה");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadItems]);

  useEffect(() => {
    if (!modalOpen) return;
    void loadTemplates();
  }, [modalOpen, loadTemplates]);

  const openNew = () => {
    setEditId(null);
    setFromPast(false);
    setTemplateIndex("");
    setFormTime(minutesToHHMM(9 * 60));
    setFormLabel("");
    setFormNote("");
    setModalOpen(true);
  };

  const openEdit = (it: PlanItem) => {
    setEditId(it.id);
    setFromPast(false);
    setTemplateIndex("");
    setFormTime(minutesToHHMM(it.timeMin));
    setFormLabel(it.label);
    setFormNote(it.note ?? "");
    setModalOpen(true);
  };

  const onPickTemplate = (value: string) => {
    setTemplateIndex(value);
    if (value === "") return;
    const i = parseInt(value, 10);
    const t = templates[i];
    if (t) {
      setFormTime(minutesToHHMM(t.timeMin));
      setFormLabel(t.label);
      setFormNote(t.note ?? "");
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const submitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const timeMin = hhmmToMinutes(formTime);
    if (timeMin === null) {
      setError("שעה לא תקינה");
      return;
    }
    const label = formLabel.trim();
    if (!label) {
      setError("נא למלא מה עושים");
      return;
    }
    const note = formNote.trim() || null;

    if (editId) {
      const r = await fetch(`/api/daily-plan/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeMin, label, note }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError((data as { error?: string }).error ?? "שמירה נכשלה");
        return;
      }
    } else {
      const r = await fetch("/api/daily-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateYmd, timeMin, label, note }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError((data as { error?: string }).error ?? "שמירה נכשלה");
        return;
      }
    }

    setModalOpen(false);
    await loadItems();
    setToast("נשמר");
    setTimeout(() => setToast(null), 2000);
  };

  const toggleDone = async (it: PlanItem) => {
    setError(null);
    const r = await fetch(`/api/daily-plan/${it.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !it.done }),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      setError((data as { error?: string }).error ?? "עדכון נכשל");
      return;
    }
    await loadItems();
  };

  const removeItem = async (it: PlanItem) => {
    if (!window.confirm("למחוק את השורה?")) return;
    setError(null);
    const r = await fetch(`/api/daily-plan/${it.id}`, { method: "DELETE" });
    if (!r.ok) {
      setError("מחיקה נכשלה");
      return;
    }
    await loadItems();
  };

  const sorted = useMemo(() => [...items].sort((a, b) => a.timeMin - b.timeMin || a.createdAt.localeCompare(b.createdAt)), [items]);

  const btnPrimary =
    "inline-flex min-h-11 min-w-[44px] touch-manipulation items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 active:bg-indigo-700";
  const btnSecondary =
    "inline-flex min-h-11 min-w-[44px] touch-manipulation items-center justify-center rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-sm font-medium text-indigo-700 shadow-sm hover:bg-indigo-50 active:bg-indigo-100 dark:border-indigo-900 dark:bg-zinc-900 dark:text-indigo-300 dark:hover:bg-zinc-800";
  const sidebarNavBtn =
    "w-full rounded-xl px-3 py-2.5 text-right text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-200/80 active:bg-zinc-300/80 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:active:bg-zinc-700";

  const dateTitle = useMemo(() => {
    const [y, m, d] = dateYmd.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("he-IL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [dateYmd]);

  return (
    <div className="flex min-h-dvh w-full flex-col lg:flex-row">
      <aside
        className="hidden shrink-0 border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-56 lg:flex-col lg:overflow-y-auto lg:border-e"
        aria-label="תפריט צד"
      >
        <nav className="flex flex-col gap-1 p-4 pt-6">
          <Link href="/dashboard" className={sidebarNavBtn}>
            ניהול דברים
          </Link>
          <button type="button" className={sidebarNavBtn} onClick={() => void logout()}>
            יציאה
          </button>
        </nav>
      </aside>

      <div className="mx-auto flex w-full min-w-0 max-w-lg flex-1 flex-col gap-4 px-3 py-4 sm:gap-5 sm:px-5 sm:py-8 lg:max-w-2xl lg:px-6">
        <header className="border-b border-zinc-200 pb-4 dark:border-zinc-800 sm:pb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 ps-[4.75rem] lg:ps-0">
              <h1 className="text-xl font-bold text-zinc-900 sm:text-2xl dark:text-white">תכנון יומי</h1>
              <p className="mt-1 text-sm text-zinc-500 sm:text-base">שלום, {user.name}</p>
            </div>
            <div className="fixed top-[max(0.75rem,env(safe-area-inset-top))] right-[max(0.75rem,env(safe-area-inset-right))] z-40 flex gap-2 lg:hidden">
              <Link
                href="/dashboard"
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-indigo-700 shadow-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-indigo-300"
              >
                ניהול
              </Link>
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        )}
        {toast && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100">
            {toast}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setDateYmd((d) => shiftYmd(d, -1))}
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              aria-label="יום קודם"
            >
              ‹
            </button>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
              <span className="sr-only">תאריך</span>
              <input
                type="date"
                value={dateYmd}
                onChange={(e) => setDateYmd(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base dark:border-zinc-600 dark:bg-zinc-900"
              />
            </label>
            <button
              type="button"
              onClick={() => setDateYmd((d) => shiftYmd(d, 1))}
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              aria-label="יום הבא"
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => setDateYmd(todayYmd())}
              className={btnSecondary}
            >
              היום
            </button>
          </div>
          <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">{dateTitle}</p>
        </div>

        {loading ? (
          <p className="py-8 text-center text-zinc-500">טוען…</p>
        ) : sorted.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 px-4 py-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
            אין עדיין שורות ליום הזה. הוסיפו פעילות עם הכפתור למטה.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sorted.map((it) => (
              <li
                key={it.id}
                className={`flex flex-wrap items-start gap-3 rounded-xl border px-3 py-3 sm:px-4 ${
                  it.done
                    ? "border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20"
                    : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900/80"
                }`}
              >
                <button
                  type="button"
                  onClick={() => void toggleDone(it)}
                  className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border-2 text-sm font-bold transition-colors ${
                    it.done
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-zinc-300 bg-white text-transparent hover:border-indigo-400 dark:border-zinc-600 dark:bg-zinc-900"
                  }`}
                  aria-pressed={it.done}
                  aria-label={it.done ? "בוצע — לחיצה לביטול" : "סמן כבוצע"}
                >
                  {it.done ? "✓" : ""}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                    <span className="font-mono text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                      {minutesToHHMM(it.timeMin)}
                    </span>
                    <span className={`text-base font-medium ${it.done ? "text-zinc-500 line-through" : "text-zinc-900 dark:text-zinc-100"}`}>
                      {it.label}
                    </span>
                  </div>
                  {it.note ? (
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{it.note}</p>
                  ) : null}
                </div>
                <div className="flex w-full shrink-0 justify-end gap-2 sm:w-auto sm:flex-col sm:items-end">
                  <button type="button" onClick={() => openEdit(it)} className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                    ערוך
                  </button>
                  <button type="button" onClick={() => void removeItem(it)} className="text-sm text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400">
                    מחק
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="pb-8">
          <button type="button" onClick={openNew} className={`${btnPrimary} w-full`}>
            הוספת שורה
          </button>
        </div>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-[52] flex min-h-dvh min-h-[100svh] items-end justify-center overflow-y-auto overscroll-contain bg-black/40 p-3 sm:items-center sm:p-4"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}
        >
          <div className="relative my-auto w-full max-w-md rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl sm:p-6 dark:bg-zinc-900">
            <div className="relative mb-4 flex min-h-9 items-center justify-center">
              <ModalCloseButton onClick={() => setModalOpen(false)} />
              <h2 className="text-center text-base font-semibold sm:text-lg">{editId ? "עריכת שורה" : "שורה חדשה"}</h2>
            </div>

            {!editId && (
              <div className="mb-4 flex rounded-xl border border-zinc-200 p-1 dark:border-zinc-700">
                <button
                  type="button"
                  onClick={() => {
                    setFromPast(false);
                    setTemplateIndex("");
                  }}
                  className={`min-h-10 flex-1 rounded-lg px-3 text-sm font-medium transition-colors ${
                    !fromPast ? "bg-indigo-600 text-white shadow-sm" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  חדש
                </button>
                <button
                  type="button"
                  onClick={() => setFromPast(true)}
                  className={`min-h-10 flex-1 rounded-lg px-3 text-sm font-medium transition-colors ${
                    fromPast ? "bg-indigo-600 text-white shadow-sm" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  מהעבר
                </button>
              </div>
            )}

            <form onSubmit={submitModal} className="flex flex-col gap-4">
              {!editId && fromPast && templates.length > 0 && (
                <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
                  <span>בחר מפעילות קודמות</span>
                  <select
                    value={templateIndex}
                    onChange={(e) => onPickTemplate(e.target.value)}
                    className="min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base dark:border-zinc-600 dark:bg-zinc-900"
                  >
                    <option value="">— בחר —</option>
                    {templates.map((t, i) => (
                      <option key={`${t.label}-${i}`} value={String(i)}>
                        {minutesToHHMM(t.timeMin)} — {t.note ? `${t.label} (${t.note})` : t.label}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-zinc-500">
                    נטענת גם השעה מהפעם האחרונה — אפשר לשנות לפני שמירה
                  </span>
                </label>
              )}

              {!editId && fromPast && templates.length === 0 && (
                <p className="text-sm text-zinc-500">עדיין אין היסטוריה — הוסיפו פעילות ב&quot;חדש&quot;.</p>
              )}

              <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
                <span>שעה</span>
                <input
                  type="time"
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                  required
                  className="min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base dark:border-zinc-600 dark:bg-zinc-900"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
                <span>מה עושים</span>
                <input
                  type="text"
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  required
                  maxLength={500}
                  className="min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base dark:border-zinc-600 dark:bg-zinc-900"
                  placeholder="למשל: ספורט, שיחה, עבודה…"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
                <span>הערה (אופציונלי)</span>
                <textarea
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  rows={2}
                  maxLength={2000}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base dark:border-zinc-600 dark:bg-zinc-900"
                />
              </label>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setModalOpen(false)} className={btnSecondary}>
                  ביטול
                </button>
                <button type="submit" className={btnPrimary}>
                  שמירה
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
