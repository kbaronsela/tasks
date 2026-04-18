"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { isContactPickerSupported, pickContactFromDevice } from "@/lib/contactPicker";
import { decodeVcfFileBytes, parseVcfText } from "@/lib/parseVcf";

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

function splitPhoneLines(phone: string): string[] {
  return phone
    .split(/[\n;|]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function telHref(segment: string): string {
  const digits = segment.replace(/[^\d+]/g, "").replace(/^00/, "+");
  return digits ? `tel:${digits}` : "#";
}

const btnSecondary =
  "inline-flex min-h-11 min-w-[44px] touch-manipulation items-center justify-center rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-sm font-medium text-indigo-700 shadow-sm hover:bg-indigo-50 active:bg-indigo-100 dark:border-indigo-900 dark:bg-zinc-900 dark:text-indigo-300 dark:hover:bg-zinc-800";

const btnPrimaryAdd =
  "inline-flex min-h-11 w-full touch-manipulation items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 active:bg-indigo-700 sm:w-auto";

function AddContactModalCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute left-0 top-0 inline-flex size-10 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      aria-label="ביטול"
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  );
}

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
  const [addContactModalOpen, setAddContactModalOpen] = useState(false);

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

  useEffect(() => {
    if (tab !== "contacts") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- סנכרון: יציאה מהטאב סוגרת את מודל ההוספה
      setAddContactModalOpen(false);
    }
  }, [tab]);

  const contactPickerSupported = useSyncExternalStore(
    () => () => {},
    isContactPickerSupported,
    () => false,
  );

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
    setAddContactModalOpen(false);
    await loadProfessionals();
    onToast("נוסף לאנשי הקשר");
  };

  const resetAddContactForm = useCallback(() => {
    setPName("");
    setPRole("");
    setPPhone("");
    setPNotes("");
    onError(null);
  }, [onError]);

  const closeAddContactModal = useCallback(() => {
    resetAddContactForm();
    setAddContactModalOpen(false);
  }, [resetAddContactForm]);

  const openAddContactModal = useCallback(() => {
    resetAddContactForm();
    setAddContactModalOpen(true);
  }, [resetAddContactForm]);

  useEffect(() => {
    if (!addContactModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAddContactModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addContactModalOpen, closeAddContactModal]);

  const onVcfFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const buf = reader.result;
      if (!(buf instanceof ArrayBuffer)) {
        onError("קריאת הקובץ נכשלה");
        return;
      }
      const text = decodeVcfFileBytes(buf);
      const parsed = parseVcfText(text);
      if (!parsed) {
        onError("לא ניתן לקרוא את קובץ ה־VCF");
        return;
      }
      const { contact, cardCount } = parsed;
      setPName(contact.name);
      setPPhone(contact.phones.join("\n"));
      setPRole(contact.role ?? "");
      setPNotes(contact.notes ?? "");
      onError(null);
      if (contact.phones.length === 0) {
        onToast(
          cardCount > 1
            ? `נטען איש הקשר הראשון מתוך ${cardCount} — לא נמצאו מספרי טלפון; ניתן להזין ידנית`
            : "השדות מולאו מהכרטיס; לא נמצאו מספרי טלפון — ניתן להזין ידנית",
        );
      } else if (cardCount > 1) {
        onToast(`נטען איש הקשר הראשון מתוך ${cardCount} בקובץ`);
      } else {
        onToast("השדות מולאו מהכרטיס");
      }
    };
    reader.onerror = () => onError("קריאת הקובץ נכשלה");
    reader.readAsArrayBuffer(file);
  };

  const onPickDeviceContact = async () => {
    onError(null);
    try {
      const contact = await pickContactFromDevice();
      if (!contact) return;
      setPName(contact.name);
      setPPhone(contact.phones.join("\n"));
      setPRole(contact.role ?? "");
      setPNotes(contact.notes ?? "");
      if (contact.phones.length === 0) {
        onToast("השדות מולאו מהמכשיר; לא נמצאו מספרי טלפון — ניתן להזין ידנית");
      } else {
        onToast("השדות מולאו מאיש הקשר במכשיר");
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "לא ניתן לקרוא איש קשר מהמכשיר");
    }
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
    const vcfInputId = `vcf-import-${topicId}`;
    return (
      <div className="flex flex-col gap-4">
        <button type="button" onClick={openAddContactModal} className={btnPrimaryAdd}>
          הוספת איש קשר
        </button>

        {addContactModalOpen && (
          <div
            className="fixed inset-0 z-[60] flex min-h-dvh min-h-[100svh] items-center justify-center overflow-y-auto overscroll-contain bg-black/40 p-3 sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-contact-modal-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeAddContactModal();
            }}
          >
            <div className="relative my-auto w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:p-5">
              <div className="relative mb-4 flex min-h-10 items-center justify-center pe-10">
                <AddContactModalCloseButton onClick={closeAddContactModal} />
                <h2 id="add-contact-modal-title" className="text-center text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  הוספת איש קשר
                </h2>
              </div>
              <form onSubmit={addProfessional} className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    ניתן למלא ידנית, לבחור איש קשר מהמכשיר (כשהדפדפן מאפשר), או לייבא קובץ VCF.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {contactPickerSupported && (
                      <button
                        type="button"
                        onClick={() => void onPickDeviceContact()}
                        className={btnSecondary}
                      >
                        בחירה מאנשי הקשר במכשיר
                      </button>
                    )}
                    <input
                      id={vcfInputId}
                      type="file"
                      accept=".vcf,text/vcard,text/x-vcard"
                      className="sr-only"
                      onChange={onVcfFile}
                    />
                    <label htmlFor={vcfInputId} className={`${btnSecondary} cursor-pointer`}>
                      ייבוא מקובץ VCF
                    </label>
                  </div>
                  {!contactPickerSupported && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      בדפדפן או במערכת הזו אין גישה ישירה לאנשי הקשר (למשל Safari באייפון). אפשר לייבא קובץ VCF
                      מהאנשים או למלא ידנית.
                    </p>
                  )}
                </div>
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
                    <textarea
                      required
                      inputMode="tel"
                      value={pPhone}
                      onChange={(e) => setPPhone(e.target.value)}
                      rows={2}
                      placeholder="מספר אחד או כמה בשורות נפרדות"
                      className="mt-1 min-h-11 w-full resize-y rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
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
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={closeAddContactModal}
                    className={`${btnSecondary} min-h-11 flex-1 sm:flex-initial`}
                  >
                    ביטול
                  </button>
                  <button
                    type="submit"
                    className="min-h-11 flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 sm:flex-initial"
                  >
                    הוספה
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <ul className="flex flex-col gap-2">
          {professionals.map((p) => (
            <li
              key={p.id}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <div className="font-medium">{p.name}</div>
              {p.role && <div className="text-sm text-zinc-600 dark:text-zinc-400">{p.role}</div>}
              <div className="flex flex-col gap-0.5 text-sm">
                {splitPhoneLines(p.phone).map((seg, i) => (
                  <a
                    key={`${p.id}-tel-${i}`}
                    href={telHref(seg)}
                    className="text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    {seg}
                  </a>
                ))}
              </div>
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
