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
  done: boolean;
  createdAt: string;
};

type Template = { label: string; timeMin: number };

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

type InlinePlanRowProps = {
  item: PlanItem;
  loadItems: () => Promise<void>;
  setError: (msg: string | null) => void;
  onToggleDone: () => void;
  onRemove: () => void;
};

function InlinePlanRow({ item, loadItems, setError, onToggleDone, onRemove }: InlinePlanRowProps) {
  const [time, setTime] = useState(() => minutesToHHMM(item.timeMin));
  const [label, setLabel] = useState(item.label);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTime(minutesToHHMM(item.timeMin));
    setLabel(item.label);
  }, [item.id, item.timeMin, item.label]);

  const save = useCallback(async () => {
    const timeMin = hhmmToMinutes(time);
    if (timeMin === null) {
      setError("שעה לא תקינה");
      setTime(minutesToHHMM(item.timeMin));
      return;
    }
    const labelT = label.trim();
    if (!labelT) {
      setError("נא למלא כותרת");
      setLabel(item.label);
      return;
    }
    if (timeMin === item.timeMin && labelT === item.label) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/daily-plan/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeMin, label: labelT }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError((data as { error?: string }).error ?? "שמירה נכשלה");
        setTime(minutesToHHMM(item.timeMin));
        setLabel(item.label);
        return;
      }
      await loadItems();
    } finally {
      setSaving(false);
    }
  }, [item, time, label, loadItems, setError]);

  const rowBorder = item.done
    ? "border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20"
    : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900/80";

  const fieldBase =
    "rounded border border-transparent bg-transparent px-1 py-0.5 text-inherit outline-none transition-colors focus:border-indigo-400 focus:bg-white/90 dark:focus:bg-zinc-900/90";

  return (
    <li className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 ${rowBorder}`}>
      <button
        type="button"
        onClick={onToggleDone}
        disabled={saving}
        className={`flex size-6 shrink-0 items-center justify-center rounded border text-[10px] font-bold leading-none transition-colors disabled:opacity-50 ${
          item.done
            ? "border-emerald-600 bg-emerald-600 text-white"
            : "border-zinc-300 bg-white text-transparent hover:border-indigo-400 dark:border-zinc-600 dark:bg-zinc-900"
        }`}
        aria-pressed={item.done}
        aria-label={item.done ? "בוצע — לחיצה לביטול" : "סמן כבוצע"}
      >
        {item.done ? "✓" : ""}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            onBlur={() => void save()}
            disabled={saving}
            className={`${fieldBase} w-[5.25rem] shrink-0 text-sm font-medium tabular-nums tracking-tight text-indigo-700 dark:text-indigo-300`}
            aria-label="שעה"
          />
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => void save()}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            disabled={saving}
            maxLength={500}
            className={`${fieldBase} min-h-7 min-w-0 flex-1 text-right text-sm font-medium ${
              item.done ? "text-zinc-500 line-through" : "text-zinc-900 dark:text-zinc-100"
            }`}
            aria-label="מה עושים"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        disabled={saving}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded text-base leading-none text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:text-zinc-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
        aria-label="מחק"
      >
        ×
      </button>
    </li>
  );
}

function ModalCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute left-0 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
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
  const [pinnedTemplates, setPinnedTemplates] = useState<Template[]>([]);
  const [suggestionTemplates, setSuggestionTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [fromPast, setFromPast] = useState(false);
  const [formTime, setFormTime] = useState("09:00");
  const [formLabel, setFormLabel] = useState("");

  const loadItems = useCallback(async () => {
    const r = await fetch(`/api/daily-plan?date=${encodeURIComponent(dateYmd)}`);
    if (!r.ok) throw new Error("טעינת התכנון נכשלה");
    const data = await r.json();
    setItems(data.items as PlanItem[]);
  }, [dateYmd]);

  const loadTemplates = useCallback(async () => {
    const r = await fetch("/api/daily-plan/templates");
    if (!r.ok) return;
    const data = await r.json();
    setPinnedTemplates((data.pinned as Template[]) ?? []);
    setSuggestionTemplates((data.suggestions as Template[]) ?? []);
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
    setFromPast(false);
    setFormTime(minutesToHHMM(9 * 60));
    setFormLabel("");
    setModalOpen(true);
  };

  const applyTemplate = (t: Template) => {
    setFormTime(minutesToHHMM(t.timeMin));
    setFormLabel(t.label);
  };

  const pinTemplate = async (t: Template) => {
    setError(null);
    const r = await fetch("/api/daily-plan/templates/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: t.label, timeMin: t.timeMin }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError((data as { error?: string }).error ?? "שמירת קבוע נכשלה");
      return;
    }
    await loadTemplates();
    setToast("נשמר לקבועות");
    setTimeout(() => setToast(null), 2000);
  };

  const unpinTemplate = async (label: string) => {
    setError(null);
    const r = await fetch(`/api/daily-plan/templates/pin?label=${encodeURIComponent(label)}`, {
      method: "DELETE",
    });
    if (!r.ok) {
      setError("הסרה מהקבועות נכשלה");
      return;
    }
    await loadTemplates();
  };

  const hideTemplate = async (label: string) => {
    setError(null);
    const r = await fetch("/api/daily-plan/templates/hide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError((data as { error?: string }).error ?? "הסתרה נכשלה");
      return;
    }
    await loadTemplates();
  };

  const saveFormAsPinned = async () => {
    const timeMin = hhmmToMinutes(formTime);
    const label = formLabel.trim();
    if (timeMin === null || !label) {
      setError("מלאו שעה ושם לפני שמירה לקבועות");
      return;
    }
    setError(null);
    const r = await fetch("/api/daily-plan/templates/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, timeMin }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError((data as { error?: string }).error ?? "שמירת קבוע נכשלה");
      return;
    }
    await loadTemplates();
    setToast("נשמר לקבועות");
    setTimeout(() => setToast(null), 2000);
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

    const r = await fetch("/api/daily-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: dateYmd, timeMin, label }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError((data as { error?: string }).error ?? "שמירה נכשלה");
      return;
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
    "inline-flex min-h-9 min-w-[40px] touch-manipulation items-center justify-center rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 active:bg-indigo-700";
  const btnSecondary =
    "inline-flex min-h-9 min-w-[40px] touch-manipulation items-center justify-center rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 shadow-sm hover:bg-indigo-50 active:bg-indigo-100 dark:border-indigo-900 dark:bg-zinc-900 dark:text-indigo-300 dark:hover:bg-zinc-800";
  const sidebarNavBtn =
    "w-full rounded-lg px-2.5 py-2 text-right text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-200/80 active:bg-zinc-300/80 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:active:bg-zinc-700";

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
        className="hidden shrink-0 border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-52 lg:flex-col lg:overflow-y-auto lg:border-e"
        aria-label="תפריט צד"
      >
        <nav className="flex flex-col gap-0.5 p-3 pt-4">
          <Link href="/dashboard" className={sidebarNavBtn}>
            ניהול דברים
          </Link>
          <button type="button" className={sidebarNavBtn} onClick={() => void logout()}>
            יציאה
          </button>
        </nav>
      </aside>

      <div className="mx-auto flex w-full min-w-0 max-w-lg flex-1 flex-col gap-2 px-2 py-2 sm:gap-2.5 sm:px-4 sm:py-3 lg:max-w-2xl lg:px-4">
        <header className="border-b border-zinc-200 pb-2 dark:border-zinc-800">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 ps-[3.5rem] lg:ps-0">
              <h1 className="text-lg font-bold leading-tight text-zinc-900 sm:text-xl dark:text-white">תכנון יומי</h1>
              <p className="text-xs text-zinc-500 sm:text-sm">שלום, {user.name}</p>
            </div>
            <div className="fixed top-[max(0.5rem,env(safe-area-inset-top))] right-[max(0.5rem,env(safe-area-inset-right))] z-40 flex gap-1.5 lg:hidden">
              <Link
                href="/dashboard"
                className="inline-flex min-h-9 items-center justify-center rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-medium text-indigo-700 shadow-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-indigo-300"
              >
                ניהול
              </Link>
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        )}
        {toast && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100">
            {toast}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setDateYmd((d) => shiftYmd(d, -1))}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white text-sm text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              aria-label="יום קודם"
            >
              ‹
            </button>
            <label className="flex min-w-0 flex-1 flex-col">
              <span className="sr-only">תאריך</span>
              <input
                type="date"
                value={dateYmd}
                onChange={(e) => setDateYmd(e.target.value)}
                className="min-h-9 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
              />
            </label>
            <button
              type="button"
              onClick={() => setDateYmd((d) => shiftYmd(d, 1))}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white text-sm text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              aria-label="יום הבא"
            >
              ›
            </button>
            <button type="button" onClick={() => setDateYmd(todayYmd())} className={btnSecondary}>
              היום
            </button>
          </div>
          <p className="text-center text-xs text-zinc-600 dark:text-zinc-400">{dateTitle}</p>
        </div>

        {loading ? (
          <p className="py-4 text-center text-xs text-zinc-500">טוען…</p>
        ) : sorted.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/80 px-2.5 py-4 text-center text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
            אין עדיין שורות ליום הזה. הוסיפו פעילות עם הכפתור למטה.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {sorted.map((it) => (
              <InlinePlanRow
                key={it.id}
                item={it}
                loadItems={loadItems}
                setError={setError}
                onToggleDone={() => void toggleDone(it)}
                onRemove={() => void removeItem(it)}
              />
            ))}
          </ul>
        )}

        <div className="pb-3 pt-0.5">
          <button type="button" onClick={openNew} className={`${btnPrimary} w-full`}>
            הוספת שורה
          </button>
        </div>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-[52] flex min-h-dvh min-h-[100svh] items-end justify-center overflow-y-auto overscroll-contain bg-black/40 p-2 sm:items-center sm:p-3"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}
        >
          <div className="relative my-auto w-full max-w-md rounded-t-xl bg-white p-3 shadow-xl sm:rounded-xl sm:p-4 dark:bg-zinc-900">
            <div className="relative mb-2 flex min-h-8 items-center justify-center">
              <ModalCloseButton onClick={() => setModalOpen(false)} />
              <h2 className="text-center text-sm font-semibold">שורה חדשה</h2>
            </div>

            <div className="mb-2 flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => setFromPast(false)}
                className={`min-h-9 flex-1 rounded-md px-2 text-xs font-medium transition-colors ${
                  !fromPast ? "bg-indigo-600 text-white shadow-sm" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                חדש
              </button>
              <button
                type="button"
                onClick={() => setFromPast(true)}
                className={`min-h-9 flex-1 rounded-md px-2 text-xs font-medium transition-colors ${
                  fromPast ? "bg-indigo-600 text-white shadow-sm" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                מהעבר
              </button>
            </div>

            <form onSubmit={submitModal} className="flex flex-col gap-2.5">
              {fromPast && (pinnedTemplates.length > 0 || suggestionTemplates.length > 0) && (
                <div className="flex flex-col gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">בחירה מהרשימה</span>
                  <p className="text-[11px] leading-snug text-zinc-500">
                    <strong className="font-medium text-zinc-600 dark:text-zinc-400">קבועות</strong> — פעילויות ששמרת (חוזרות).{" "}
                    <strong className="font-medium text-zinc-600 dark:text-zinc-400">מהעבר</strong> — מה שכבר תכננת; אפשר{" "}
                    <strong>הסתר</strong> לחד־פעמיות או <strong>קבע</strong> לחוזרות.
                  </p>
                  <div className="max-h-44 space-y-2 overflow-y-auto overscroll-contain rounded-lg border border-zinc-200 bg-zinc-50/80 p-2 dark:border-zinc-700 dark:bg-zinc-950/40">
                    {pinnedTemplates.length > 0 && (
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                          קבועות
                        </p>
                        <ul className="flex flex-col gap-1">
                          {pinnedTemplates.map((t) => (
                            <li
                              key={`p-${t.label}`}
                              className="flex items-center gap-1 rounded-md border border-indigo-100 bg-white px-1.5 py-1 dark:border-indigo-900/50 dark:bg-zinc-900"
                            >
                              <button
                                type="button"
                                onClick={() => applyTemplate(t)}
                                className="min-w-0 flex-1 truncate text-right text-xs text-zinc-800 hover:underline dark:text-zinc-100"
                              >
                                <span className="tabular-nums tracking-tight">{minutesToHHMM(t.timeMin)}</span> — {t.label}
                              </button>
                              <button
                                type="button"
                                onClick={() => void unpinTemplate(t.label)}
                                className="shrink-0 rounded px-1 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                              >
                                הסר
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {suggestionTemplates.length > 0 && (
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">מהעבר</p>
                        <ul className="flex flex-col gap-1">
                          {suggestionTemplates.map((t) => (
                            <li
                              key={`s-${t.label}-${t.timeMin}`}
                              className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-1.5 py-1 dark:border-zinc-600 dark:bg-zinc-900"
                            >
                              <button
                                type="button"
                                onClick={() => applyTemplate(t)}
                                className="min-w-0 flex-1 truncate text-right text-xs text-zinc-800 hover:underline dark:text-zinc-100"
                              >
                                <span className="tabular-nums tracking-tight">{minutesToHHMM(t.timeMin)}</span> — {t.label}
                              </button>
                              <button
                                type="button"
                                onClick={() => void pinTemplate(t)}
                                className="shrink-0 rounded px-1 py-0.5 text-[10px] font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/50"
                              >
                                קבע
                              </button>
                              <button
                                type="button"
                                onClick={() => void hideTemplate(t.label)}
                                className="shrink-0 rounded px-1 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                              >
                                הסתר
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {fromPast && pinnedTemplates.length === 0 && suggestionTemplates.length === 0 && (
                <p className="text-xs text-zinc-500">
                  אין עדיין הצעות. הוסיפו פעילות בלשונית &quot;חדש&quot;, או שמרו כאן שעה ושם ולחצו &quot;שמור כקבועות&quot;.
                </p>
              )}

              <label className="flex flex-col gap-0.5 text-xs text-zinc-700 dark:text-zinc-300">
                <span>שעה</span>
                <input
                  type="time"
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                  required
                  className="min-h-9 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm font-medium tabular-nums tracking-tight text-indigo-800 dark:border-zinc-600 dark:bg-zinc-900 dark:text-indigo-200"
                />
              </label>

              <label className="flex flex-col gap-0.5 text-xs text-zinc-700 dark:text-zinc-300">
                <span>מה עושים</span>
                <input
                  type="text"
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  required
                  maxLength={500}
                  className="min-h-9 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                  placeholder="למשל: ספורט, שיחה, עבודה…"
                />
              </label>

              {fromPast && (
                <button
                  type="button"
                  onClick={() => void saveFormAsPinned()}
                  className="w-full rounded-lg border border-indigo-200 bg-indigo-50/80 py-2 text-xs font-medium text-indigo-800 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200 dark:hover:bg-indigo-950/70"
                >
                  שמור שעה ושם כקבועות
                </button>
              )}

              <div className="flex flex-col gap-1.5 pt-0.5 sm:flex-row sm:justify-end">
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
