"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type HubUser = { id: string; name: string; email: string };

type ExpenseRow = {
  id: string;
  amount: string;
  currency: string;
  description: string | null;
  spentAt: string;
  assignedUser: HubUser | null;
};

type ProfessionalRow = {
  id: string;
  name: string;
  role: string | null;
  phone: string;
  notes: string | null;
};

type EventRow = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  location: string | null;
};

type ListItemRow = {
  id: string;
  title: string;
  done?: boolean;
  packed?: boolean;
  position: number;
};

function datetimeLocalToUtcIso(localValue: string): string | null {
  const t = localValue?.trim() ?? "";
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function toDateInput(iso: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function formatHe(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

const btnSecondary =
  "inline-flex min-h-11 min-w-[44px] touch-manipulation items-center justify-center rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-sm font-medium text-indigo-700 shadow-sm hover:bg-indigo-50 active:bg-indigo-100 dark:border-indigo-900 dark:bg-zinc-900 dark:text-indigo-300 dark:hover:bg-zinc-800";

export function TopicHubSections({
  topicId,
  tab,
  topicUsers,
  onToast,
  onError,
}: {
  topicId: string;
  tab: "expenses" | "contacts" | "dates" | "shopping" | "packing";
  /** משתמשים המשויכים לנושא — לשיוך הוצאות */
  topicUsers: HubUser[];
  onToast: (msg: string) => void;
  onError: (msg: string | null) => void;
}) {
  const base = `/api/topics/${topicId}`;

  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expenseAssignedUserId, setExpenseAssignedUserId] = useState("");

  const [professionals, setProfessionals] = useState<ProfessionalRow[]>([]);
  const [pName, setPName] = useState("");
  const [pRole, setPRole] = useState("");
  const [pPhone, setPPhone] = useState("");
  const [pNotes, setPNotes] = useState("");

  const [events, setEvents] = useState<EventRow[]>([]);
  const [evTitle, setEvTitle] = useState("");
  const [evStart, setEvStart] = useState("");
  const [evEnd, setEvEnd] = useState("");
  const [evAllDay, setEvAllDay] = useState(false);
  const [evLoc, setEvLoc] = useState("");

  const [shop, setShop] = useState<ListItemRow[]>([]);
  const [shopNew, setShopNew] = useState("");

  const [pack, setPack] = useState<ListItemRow[]>([]);
  const [packNew, setPackNew] = useState("");

  const loadExpenses = useCallback(async () => {
    const r = await fetch(`${base}/expenses`);
    if (!r.ok) throw new Error("טעינת הוצאות נכשלה");
    const d = await r.json();
    setExpenses(d.expenses ?? []);
  }, [base]);

  const loadProfessionals = useCallback(async () => {
    const r = await fetch(`${base}/professionals`);
    if (!r.ok) throw new Error("טעינת אנשי מקצוע נכשלה");
    const d = await r.json();
    setProfessionals(d.professionals ?? []);
  }, [base]);

  const loadEvents = useCallback(async () => {
    const r = await fetch(`${base}/events`);
    if (!r.ok) throw new Error("טעינת תאריכים נכשלה");
    const d = await r.json();
    setEvents(d.events ?? []);
  }, [base]);

  const loadShopping = useCallback(async () => {
    const r = await fetch(`${base}/shopping`);
    if (!r.ok) throw new Error("טעינת רשימת קניות נכשלה");
    const d = await r.json();
    setShop(d.items ?? []);
  }, [base]);

  const loadPacking = useCallback(async () => {
    const r = await fetch(`${base}/packing`);
    if (!r.ok) throw new Error("טעינת רשימת ציוד נכשלה");
    const d = await r.json();
    setPack(d.items ?? []);
  }, [base]);

  useEffect(() => {
    onError(null);
    let cancelled = false;
    (async () => {
      try {
        if (tab === "expenses") await loadExpenses();
        else if (tab === "contacts") await loadProfessionals();
        else if (tab === "dates") await loadEvents();
        else if (tab === "shopping") await loadShopping();
        else if (tab === "packing") await loadPacking();
      } catch (e) {
        if (!cancelled) onError(e instanceof Error ? e.message : "שגיאה");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, topicId, loadExpenses, loadProfessionals, loadEvents, loadShopping, loadPacking, onError]);

  const expenseTotal = useMemo(() => {
    let s = 0;
    for (const e of expenses) {
      const n = parseFloat(e.amount);
      if (Number.isFinite(n)) s += n;
    }
    return s;
  }, [expenses]);

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    onError(null);
    const r = await fetch(`${base}/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: expenseAmount,
        description: expenseDesc || null,
        spentAt: expenseDate ? `${expenseDate}T12:00:00.000Z` : undefined,
        assignedUserId: expenseAssignedUserId.trim() || null,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      onError(j.error ?? "שמירה נכשלה");
      return;
    }
    setExpenseAmount("");
    setExpenseDesc("");
    setExpenseAssignedUserId("");
    await loadExpenses();
    onToast("ההוצאה נוספה");
  };

  const patchExpenseAssignedUser = async (expenseId: string, userId: string) => {
    onError(null);
    const r = await fetch(`${base}/expenses/${expenseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignedUserId: userId.trim() ? userId : null,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      onError(j.error ?? "עדכון שיוך נכשל");
      return;
    }
    await loadExpenses();
  };

  const delExpense = async (id: string) => {
    if (!confirm("למחוק את ההוצאה?")) return;
    onError(null);
    const r = await fetch(`${base}/expenses/${id}`, { method: "DELETE" });
    if (!r.ok) {
      onError("מחיקה נכשלה");
      return;
    }
    await loadExpenses();
    onToast("נמחק");
  };

  const addProfessional = async (e: React.FormEvent) => {
    e.preventDefault();
    onError(null);
    const r = await fetch(`${base}/professionals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: pName,
        role: pRole || null,
        phone: pPhone,
        notes: pNotes || null,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      onError(j.error ?? "שמירה נכשלה");
      return;
    }
    setPName("");
    setPRole("");
    setPPhone("");
    setPNotes("");
    await loadProfessionals();
    onToast("נוסף לאנשי הקשר");
  };

  const delProfessional = async (id: string) => {
    if (!confirm("למחוק?")) return;
    onError(null);
    const r = await fetch(`${base}/professionals/${id}`, { method: "DELETE" });
    if (!r.ok) {
      onError("מחיקה נכשלה");
      return;
    }
    await loadProfessionals();
  };

  const addEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    onError(null);
    let startsAt: string;
    let endsAt: string | null = null;
    if (evAllDay) {
      const d = evStart.slice(0, 10);
      startsAt = `${d}T00:00:00.000Z`;
      if (evEnd.trim()) {
        const de = evEnd.slice(0, 10);
        endsAt = `${de}T23:59:59.999Z`;
      }
    } else {
      const s = datetimeLocalToUtcIso(evStart);
      if (!s) {
        onError("תאריך התחלה נדרש");
        return;
      }
      startsAt = s;
      const en = datetimeLocalToUtcIso(evEnd);
      endsAt = en;
    }
    const r = await fetch(`${base}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: evTitle,
        startsAt,
        endsAt,
        allDay: evAllDay,
        location: evLoc || null,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      onError(j.error ?? "שמירה נכשלה");
      return;
    }
    setEvTitle("");
    setEvStart("");
    setEvEnd("");
    setEvLoc("");
    await loadEvents();
    onToast("האירוע נוסף");
  };

  const delEvent = async (id: string) => {
    if (!confirm("למחוק את האירוע?")) return;
    onError(null);
    const r = await fetch(`${base}/events/${id}`, { method: "DELETE" });
    if (!r.ok) {
      onError("מחיקה נכשלה");
      return;
    }
    await loadEvents();
  };

  const addShop = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = shopNew.trim();
    if (!title) return;
    onError(null);
    const r = await fetch(`${base}/shopping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      onError(j.error ?? "שמירה נכשלה");
      return;
    }
    setShopNew("");
    await loadShopping();
  };

  const toggleShop = async (item: ListItemRow) => {
    onError(null);
    const r = await fetch(`${base}/shopping/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !item.done }),
    });
    if (!r.ok) {
      onError("עדכון נכשל");
      return;
    }
    await loadShopping();
  };

  const delShop = async (id: string) => {
    onError(null);
    const r = await fetch(`${base}/shopping/${id}`, { method: "DELETE" });
    if (!r.ok) {
      onError("מחיקה נכשלה");
      return;
    }
    await loadShopping();
  };

  const addPack = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = packNew.trim();
    if (!title) return;
    onError(null);
    const r = await fetch(`${base}/packing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      onError(j.error ?? "שמירה נכשלה");
      return;
    }
    setPackNew("");
    await loadPacking();
  };

  const togglePack = async (item: ListItemRow) => {
    onError(null);
    const r = await fetch(`${base}/packing/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packed: !item.packed }),
    });
    if (!r.ok) {
      onError("עדכון נכשל");
      return;
    }
    await loadPacking();
  };

  const delPack = async (id: string) => {
    onError(null);
    const r = await fetch(`${base}/packing/${id}`, { method: "DELETE" });
    if (!r.ok) {
      onError("מחיקה נכשלה");
      return;
    }
    await loadPacking();
  };

  if (tab === "expenses") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          סה״כ בנושא: <span className="font-semibold text-zinc-900 dark:text-white">{expenseTotal.toFixed(2)} ₪</span>
        </p>
        <form onSubmit={addExpense} className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              סכום
              <input
                required
                inputMode="decimal"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
                placeholder="0"
              />
            </label>
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              תאריך הוצאה
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
              />
            </label>
          </div>
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            תיאור (אופציונלי)
            <input
              value={expenseDesc}
              onChange={(e) => setExpenseDesc(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
            />
          </label>
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            משויך למשתמש (אופציונלי)
            <select
              value={expenseAssignedUserId}
              onChange={(e) => setExpenseAssignedUserId(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
            >
              <option value="">ללא שיוך</option>
              {topicUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            הוספת הוצאה
          </button>
        </form>
        <ul className="flex flex-col gap-2">
          {expenses.map((x) => (
            <li
              key={x.id}
              className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <span className="font-medium">{parseFloat(x.amount).toLocaleString("he-IL")} ₪</span>
                {x.description && (
                  <span className="mr-2 text-zinc-600 dark:text-zinc-400">— {x.description}</span>
                )}
                <span className="mr-2 block text-xs text-zinc-500 sm:inline">
                  {formatHe(x.spentAt)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex min-w-[10rem] flex-col gap-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                  משויך
                  <select
                    value={x.assignedUser?.id ?? ""}
                    onChange={(e) => void patchExpenseAssignedUser(x.id, e.target.value)}
                    className="min-h-9 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    <option value="">ללא שיוך</option>
                    {x.assignedUser &&
                      !topicUsers.some((u) => u.id === x.assignedUser!.id) && (
                        <option value={x.assignedUser.id}>{x.assignedUser.name} (הוסר מהנושא)</option>
                      )}
                    {topicUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => void delExpense(x.id)}
                  className="shrink-0 self-end text-sm text-red-600 hover:underline sm:self-center"
                >
                  מחיקה
                </button>
              </div>
            </li>
          ))}
        </ul>
        {expenses.length === 0 && <p className="text-sm text-zinc-500">אין הוצאות עדיין.</p>}
      </div>
    );
  }

  if (tab === "contacts") {
    return (
      <div className="flex flex-col gap-4">
        <form onSubmit={addProfessional} className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              שם
              <input
                required
                value={pName}
                onChange={(e) => setPName(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
              />
            </label>
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              טלפון
              <input
                required
                inputMode="tel"
                value={pPhone}
                onChange={(e) => setPPhone(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
              />
            </label>
          </div>
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            תפקיד / תיאור קצר
            <input
              value={pRole}
              onChange={(e) => setPRole(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
            />
          </label>
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            הערות
            <textarea
              value={pNotes}
              onChange={(e) => setPNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
            />
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            הוספה
          </button>
        </form>
        <ul className="flex flex-col gap-2">
          {professionals.map((p) => (
            <li
              key={p.id}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <div className="font-medium">{p.name}</div>
              {p.role && <div className="text-sm text-zinc-600 dark:text-zinc-400">{p.role}</div>}
              <a href={`tel:${p.phone.replace(/\s/g, "")}`} className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
                {p.phone}
              </a>
              {p.notes && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{p.notes}</p>}
              <button
                type="button"
                onClick={() => void delProfessional(p.id)}
                className="mt-2 text-sm text-red-600 hover:underline"
              >
                מחיקה
              </button>
            </li>
          ))}
        </ul>
        {professionals.length === 0 && <p className="text-sm text-zinc-500">אין רשומות עדיין.</p>}
      </div>
    );
  }

  if (tab === "dates") {
    return (
      <div className="flex flex-col gap-4">
        <form onSubmit={addEvent} className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={evAllDay}
              onChange={(e) => setEvAllDay(e.target.checked)}
              className="size-5 rounded border-zinc-300"
            />
            כל היום
          </label>
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            כותרת
            <input
              required
              value={evTitle}
              onChange={(e) => setEvTitle(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
            />
          </label>
          {evAllDay ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                תאריך
                <input
                  type="date"
                  required
                  value={evStart.slice(0, 10)}
                  onChange={(e) => setEvStart(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
                />
              </label>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                עד תאריך (אופציונלי)
                <input
                  type="date"
                  value={evEnd.slice(0, 10)}
                  onChange={(e) => setEvEnd(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
                />
              </label>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                התחלה
                <input
                  type="datetime-local"
                  required
                  value={evStart}
                  onChange={(e) => setEvStart(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
                />
              </label>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                סיום (אופציונלי)
                <input
                  type="datetime-local"
                  value={evEnd}
                  onChange={(e) => setEvEnd(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
                />
              </label>
            </div>
          )}
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            מיקום (אופציונלי)
            <input
              value={evLoc}
              onChange={(e) => setEvLoc(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
            />
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            הוספת תאריך / אירוע
          </button>
        </form>
        <ul className="flex flex-col gap-2">
          {events.map((ev) => (
            <li
              key={ev.id}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <div className="font-medium">{ev.title}</div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                {ev.allDay ? (
                  <>
                    {toDateInput(ev.startsAt)}
                    {ev.endsAt && ` – ${toDateInput(ev.endsAt)}`}
                  </>
                ) : (
                  <>
                    {formatHe(ev.startsAt)}
                    {ev.endsAt && ` – ${formatHe(ev.endsAt)}`}
                  </>
                )}
              </div>
              {ev.location && (
                <div className="text-sm text-zinc-500">{ev.location}</div>
              )}
              <button
                type="button"
                onClick={() => void delEvent(ev.id)}
                className="mt-2 text-sm text-red-600 hover:underline"
              >
                מחיקה
              </button>
            </li>
          ))}
        </ul>
        {events.length === 0 && <p className="text-sm text-zinc-500">אין תאריכים עדיין.</p>}
      </div>
    );
  }

  if (tab === "shopping") {
    return (
      <div className="flex flex-col gap-4">
        <form onSubmit={addShop} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            פריט חדש
            <input
              value={shopNew}
              onChange={(e) => setShopNew(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
              placeholder="למשל חלב"
            />
          </label>
          <button type="submit" className={`${btnSecondary} shrink-0`}>
            הוספה
          </button>
        </form>
        <ul className="flex flex-col gap-2">
          {shop.map((it) => (
            <li
              key={it.id}
              className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <input
                type="checkbox"
                checked={it.done}
                onChange={() => void toggleShop(it)}
                className="mt-1 size-5 shrink-0 rounded border-zinc-300 text-indigo-600"
                aria-label="נרכש"
              />
              <span className={`min-w-0 flex-1 ${it.done ? "text-zinc-400 line-through" : ""}`}>{it.title}</span>
              <button
                type="button"
                onClick={() => void delShop(it.id)}
                className="shrink-0 text-sm text-red-600 hover:underline"
              >
                מחיקה
              </button>
            </li>
          ))}
        </ul>
        {shop.length === 0 && <p className="text-sm text-zinc-500">הרשימה ריקה.</p>}
      </div>
    );
  }

  if (tab === "packing") {
    return (
      <div className="flex flex-col gap-4">
        <form onSubmit={addPack} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            פריט לקחת
            <input
              value={packNew}
              onChange={(e) => setPackNew(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
              placeholder="למשל מטען"
            />
          </label>
          <button type="submit" className={`${btnSecondary} shrink-0`}>
            הוספה
          </button>
        </form>
        <ul className="flex flex-col gap-2">
          {pack.map((it) => (
            <li
              key={it.id}
              className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <input
                type="checkbox"
                checked={it.packed}
                onChange={() => void togglePack(it)}
                className="mt-1 size-5 shrink-0 rounded border-zinc-300 text-indigo-600"
                aria-label="נארז"
              />
              <span className={`min-w-0 flex-1 ${it.packed ? "text-zinc-400 line-through" : ""}`}>{it.title}</span>
              <button
                type="button"
                onClick={() => void delPack(it.id)}
                className="shrink-0 text-sm text-red-600 hover:underline"
              >
                מחיקה
              </button>
            </li>
          ))}
        </ul>
        {pack.length === 0 && <p className="text-sm text-zinc-500">הרשימה ריקה.</p>}
      </div>
    );
  }

  return null;
}
