"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { contrastOnBackground, resolveTopicColor } from "@/lib/topic-color";
import { TopicHubSections } from "@/components/TopicHubSections";

type HubTab = "tasks" | "expenses" | "contacts" | "dates" | "shopping" | "packing";

type User = { id: string; name: string; email: string };

type Topic = {
  id: string;
  title: string;
  color: string | null;
  createdAt: string;
  taskCount: number;
  users: User[];
};

type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  done: boolean;
  doneAt: string | null;
  scheduledAt: string | null;
  dueAt: string | null;
  createdAt: string;
  topic: { id: string; title: string; color: string | null } | null;
  users: User[];
  assignedToMe: boolean;
  prerequisites: { id: string; title: string; done: boolean }[];
};

function topicLabelStyle(topic: { id: string; color: string | null }) {
  const bg = resolveTopicColor(topic);
  return { backgroundColor: bg, color: contrastOnBackground(bg) } as const;
}

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

/** ערך מ־datetime-local (שעון מקומי של המשתמש) → מחרוזת ISO ב-UTC לשמירה בשרת בלי הזזת שעה לפי TZ של המכונה */
function datetimeLocalToUtcIso(localValue: string): string | null {
  const t = localValue?.trim() ?? "";
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formatHeDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function ModalCloseButton({
  onClick,
  align = "center",
}: {
  onClick: () => void;
  align?: "center" | "top";
}) {
  const alignCls =
    align === "center" ? "top-1/2 -translate-y-1/2" : "top-0";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`absolute left-0 inline-flex size-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 ${alignCls}`}
      aria-label="סגור"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden
      >
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  );
}

export function TaskDashboard({ user }: { user: User & { id: string } }) {
  const router = useRouter();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  /** נושא פעיל לתצוגת המרכז; null כשאין נושאים במערכת */
  const [focusTopicId, setFocusTopicId] = useState<string | null>(null);
  const [hubTab, setHubTab] = useState<HubTab>("tasks");
  const [dateFilterFrom, setDateFilterFrom] = useState("");
  const [dateFilterTo, setDateFilterTo] = useState("");
  /** רק מטלות שהמשתמש המחובר משויך אליהן (משמעותי כשנבחר נושא — מסתיר מטלות של אחרים בנושא) */
  const [onlyMyTasks, setOnlyMyTasks] = useState(false);
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [topicModal, setTopicModal] = useState(false);
  const [topicTitle, setTopicTitle] = useState("");
  const [topicUserIds, setTopicUserIds] = useState<string[]>([]);
  const [topicColorAuto, setTopicColorAuto] = useState(true);
  const [topicColorHex, setTopicColorHex] = useState("#6366f1");

  const [taskModal, setTaskModal] = useState(false);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskTopicId, setTaskTopicId] = useState<string>("");
  const [taskScheduled, setTaskScheduled] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [taskUserIds, setTaskUserIds] = useState<string[]>([]);
  const [taskPrereqIds, setTaskPrereqIds] = useState<string[]>([]);
  const [taskPrereqModalOpen, setTaskPrereqModalOpen] = useState(false);

  const [topicModalForTask, setTopicModalForTask] = useState(false);

  const [topicsListModalOpen, setTopicsListModalOpen] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editTopicTitle, setEditTopicTitle] = useState("");
  const [editTopicUserIds, setEditTopicUserIds] = useState<string[]>([]);
  const [editTopicColorAuto, setEditTopicColorAuto] = useState(true);
  const [editTopicColorHex, setEditTopicColorHex] = useState("#6366f1");

  const [inviteSending, setInviteSending] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [copyInviteHint, setCopyInviteHint] = useState<string | null>(null);

  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [draftDateFrom, setDraftDateFrom] = useState("");
  const [draftDateTo, setDraftDateTo] = useState("");
  const [draftOnlyMyTasks, setDraftOnlyMyTasks] = useState(false);

  const loadTopics = useCallback(async () => {
    const r = await fetch("/api/topics");
    if (!r.ok) throw new Error("טעינת נושאים נכשלה");
    const data = await r.json();
    setTopics(data.topics);
  }, []);

  const loadTasks = useCallback(async () => {
    const params = new URLSearchParams();
    const topicParam = focusTopicId ?? "all";
    if (topicParam !== "all") {
      params.set("topic", topicParam);
    }
    if (showCompletedTasks) {
      params.set("showCompleted", "1");
    }
    if (dateFilterFrom) {
      params.set("dateFrom", dateFilterFrom);
    }
    if (dateFilterTo) {
      params.set("dateTo", dateFilterTo);
    }
    if (onlyMyTasks) {
      params.set("onlyMine", "1");
    }
    const q = params.toString() ? `?${params.toString()}` : "";
    const r = await fetch(`/api/tasks${q}`);
    if (!r.ok) throw new Error("טעינת מטלות נכשלה");
    const data = await r.json();
    setTasks(data.tasks);
  }, [focusTopicId, showCompletedTasks, dateFilterFrom, dateFilterTo, onlyMyTasks]);

  useEffect(() => {
    if (topics.length === 0) {
      setFocusTopicId(null);
      setHubTab("tasks");
      setOnlyMyTasks(false);
      return;
    }
    setFocusTopicId((prev) => {
      if (prev && topics.some((t) => t.id === prev)) return prev;
      return topics[0].id;
    });
  }, [topics]);

  const loadUsers = useCallback(async () => {
    const r = await fetch("/api/users");
    if (!r.ok) throw new Error("טעינת משתמשים נכשלה");
    const data = await r.json();
    setAllUsers(data.users);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([loadTopics(), loadUsers()]);
        await loadTasks();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "שגיאה");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadTopics, loadTasks, loadUsers]);

  useEffect(() => {
    if (!inviteModalOpen) return;
    setInviteUrl(null);
    setInviteError(null);
    setCopyInviteHint(null);
    setInviteSending(true);
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/invitations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        const data = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok) {
          setInviteError(data.error ?? "יצירת קישור הזמנה נכשלה");
          return;
        }
        setInviteUrl(typeof data.inviteUrl === "string" ? data.inviteUrl : null);
      } finally {
        if (!cancelled) setInviteSending(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inviteModalOpen]);

  const openNewTask = useCallback(() => {
    setEditTaskId(null);
    setTaskTitle("");
    setTaskDescription("");
    setTaskTopicId(focusTopicId ?? "");
    setTaskScheduled("");
    setTaskDue("");
    setTaskUserIds([user.id]);
    setTaskPrereqIds([]);
    setTaskModal(true);
  }, [user.id, focusTopicId]);

  const openNewTopicModal = useCallback(() => {
    setTopicModalForTask(false);
    setTopicUserIds([user.id]);
    setTopicTitle("");
    setTopicColorAuto(true);
    setTopicColorHex("#6366f1");
    setTopicModal(true);
  }, [user.id]);

  const openTopicModalFromTask = useCallback(() => {
    setTopicModalForTask(true);
    setTopicUserIds([user.id]);
    setTopicTitle("");
    setTopicColorAuto(true);
    setTopicColorHex("#6366f1");
    setTopicModal(true);
  }, [user.id]);

  useEffect(() => {
    if (loading) return;

    const isTypingContext = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      if (el.isContentEditable) return true;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      return Boolean(el.closest?.("[contenteditable='true']"));
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.altKey || e.shiftKey) return;
      const k = e.key.toLowerCase();
      if (k !== "t" && k !== "n") return;
      if (isTypingContext(e.target)) return;
      if (
        topicModal ||
        taskModal ||
        taskPrereqModalOpen ||
        inviteModalOpen ||
        topicsListModalOpen ||
        editingTopicId ||
        filterModalOpen
      )
        return;

      if (k === "t") {
        e.preventDefault();
        openNewTopicModal();
      } else {
        e.preventDefault();
        openNewTask();
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [
    loading,
    topicModal,
    taskModal,
    taskPrereqModalOpen,
    inviteModalOpen,
    topicsListModalOpen,
    editingTopicId,
    filterModalOpen,
    openNewTopicModal,
    openNewTask,
  ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (inviteModalOpen) {
        e.preventDefault();
        setInviteModalOpen(false);
        return;
      }
      if (topicModal) {
        e.preventDefault();
        setTopicModal(false);
        setTopicModalForTask(false);
        return;
      }
      if (editingTopicId) {
        e.preventDefault();
        setEditingTopicId(null);
        return;
      }
      if (topicsListModalOpen) {
        e.preventDefault();
        setTopicsListModalOpen(false);
        return;
      }
      if (filterModalOpen) {
        e.preventDefault();
        setFilterModalOpen(false);
        return;
      }
      if (taskPrereqModalOpen) {
        e.preventDefault();
        setTaskPrereqModalOpen(false);
        return;
      }
      if (taskModal) {
        e.preventDefault();
        setTaskModal(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    inviteModalOpen,
    topicModal,
    editingTopicId,
    topicsListModalOpen,
    filterModalOpen,
    taskPrereqModalOpen,
    taskModal,
  ]);

  useEffect(() => {
    if (!taskModal) setTaskPrereqModalOpen(false);
  }, [taskModal]);

  const openEditTask = (t: TaskItem) => {
    setEditTaskId(t.id);
    setTaskTitle(t.title);
    setTaskDescription(t.description ?? "");
    setTaskTopicId(t.topic?.id ?? "");
    setTaskScheduled(toDatetimeLocalValue(t.scheduledAt));
    setTaskDue(toDatetimeLocalValue(t.dueAt));
    setTaskUserIds(t.users.map((u) => u.id));
    setTaskPrereqIds(t.prerequisites.map((p) => p.id));
    setTaskModal(true);
  };

  const submitTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const linkingToTask = topicModalForTask;
    const r = await fetch("/api/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: topicTitle,
        userIds: topicUserIds,
        color: topicColorAuto ? null : topicColorHex,
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(data.error ?? "שמירה נכשלה");
      return;
    }
    const newId = data.topic?.id as string | undefined;
    setTopicModal(false);
    setTopicModalForTask(false);
    setTopicTitle("");
    setTopicUserIds([]);
    setTopicColorAuto(true);
    setTopicColorHex("#6366f1");
    await loadTopics();
    if (newId) setFocusTopicId(newId);
    if (linkingToTask && newId) {
      setTaskTopicId(newId);
      setToast("הנושא נוסף למטלה");
    } else {
      setToast("הנושא נוצר בהצלחה");
    }
    setTimeout(() => setToast(null), 3000);
  };

  const openEditTopic = (t: Topic) => {
    setEditingTopicId(t.id);
    setEditTopicTitle(t.title);
    setEditTopicUserIds(t.users.map((u) => u.id));
    const auto = !t.color;
    setEditTopicColorAuto(auto);
    setEditTopicColorHex(t.color ?? resolveTopicColor(t));
  };

  const submitEditTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTopicId) return;
    setError(null);
    const r = await fetch(`/api/topics/${editingTopicId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editTopicTitle,
        userIds: editTopicUserIds,
        color: editTopicColorAuto ? null : editTopicColorHex,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(j.error ?? "שמירה נכשלה");
      return;
    }
    setEditingTopicId(null);
    await loadTopics();
    await loadTasks();
    setToast("הנושא עודכן");
    setTimeout(() => setToast(null), 3000);
  };

  const deleteTopic = async (id: string) => {
    if (!confirm("למחוק את הנושא? המטלות יישארו ללא נושא.")) return;
    setError(null);
    const r = await fetch(`/api/topics/${id}`, { method: "DELETE" });
    if (!r.ok) {
      setError("מחיקה נכשלה");
      return;
    }
    if (taskTopicId === id) setTaskTopicId("");
    await loadTopics();
    await loadTasks();
    setToast("הנושא נמחק");
    setTimeout(() => setToast(null), 3000);
  };

  const submitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload = {
      title: taskTitle,
      description: taskDescription || null,
      topicId: taskTopicId || null,
      scheduledAt: datetimeLocalToUtcIso(taskScheduled),
      dueAt: datetimeLocalToUtcIso(taskDue),
      userIds: taskUserIds,
      dependsOnTaskIds: taskPrereqIds,
    };
    const r = editTaskId
      ? await fetch(`/api/tasks/${editTaskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j.error ?? "שמירה נכשלה");
      return;
    }
    setTaskModal(false);
    await loadTasks();
    await loadTopics();
    setToast(editTaskId ? "המטלה עודכנה" : "המטלה נוצרה");
    setTimeout(() => setToast(null), 3000);
  };

  const toggleDone = async (t: TaskItem, next: boolean) => {
    if (!t.assignedToMe) return;
    setError(null);
    const r = await fetch(`/api/tasks/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: next }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j.error ?? "עדכון נכשל");
      return;
    }
    if (next && !t.done) {
      confetti({
        particleCount: 140,
        spread: 72,
        origin: { y: 0.62 },
        colors: ["#6366f1", "#a855f7", "#22c55e", "#f59e0b"],
      });
      setToast("כל הכבוד! סיימת את המטלה 🎉");
      setTimeout(() => setToast(null), 4500);
    }
    await loadTasks();
  };

  const deleteTask = async (id: string) => {
    if (!confirm("למחוק את המטלה?")) return;
    const r = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (!r.ok) {
      setError("מחיקה נכשלה");
      return;
    }
    await loadTasks();
    await loadTopics();
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const inviteTextToCopy = useMemo(() => {
    if (!inviteUrl) return "";
    return `היי,\n\n${user.name} הזמין/ה אותך להצטרף לאתר ניהול הדברים.\n\nלהרשמה:\n${inviteUrl}\n\nהקישור תקף למספר ימים.`;
  }, [inviteUrl, user.name]);

  const copyInviteText = async () => {
    if (!inviteTextToCopy) return;
    try {
      await navigator.clipboard.writeText(inviteTextToCopy);
      setCopyInviteHint("הטקסט הועתק ללוח");
      setTimeout(() => setCopyInviteHint(null), 2500);
    } catch {
      setCopyInviteHint("לא ניתן להעתיק — סמני את הטקסט ידנית");
      setTimeout(() => setCopyInviteHint(null), 3500);
    }
  };

  const prereqOptions = useMemo(() => {
    return tasks.filter((x) => x.id !== editTaskId);
  }, [tasks, editTaskId]);

  const openFilterModal = useCallback(() => {
    setDraftDateFrom(dateFilterFrom);
    setDraftDateTo(dateFilterTo);
    setDraftOnlyMyTasks(onlyMyTasks);
    setFilterModalOpen(true);
  }, [dateFilterFrom, dateFilterTo, onlyMyTasks]);

  const applyTaskFilters = () => {
    setDateFilterFrom(draftDateFrom);
    setDateFilterTo(draftDateTo);
    setOnlyMyTasks(draftOnlyMyTasks);
    setFilterModalOpen(false);
  };

  const cancelFilterModal = () => {
    setFilterModalOpen(false);
  };

  const removeAllTaskFilters = () => {
    setDateFilterFrom("");
    setDateFilterTo("");
    setOnlyMyTasks(false);
    setDraftDateFrom("");
    setDraftDateTo("");
    setDraftOnlyMyTasks(false);
    setFilterModalOpen(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center px-4 text-zinc-500">
        טוען…
      </div>
    );
  }

  const btnPrimary =
    "inline-flex min-h-11 min-w-[44px] touch-manipulation items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 active:bg-indigo-700";
  const btnSecondary =
    "inline-flex min-h-11 min-w-[44px] touch-manipulation items-center justify-center rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-sm font-medium text-indigo-700 shadow-sm hover:bg-indigo-50 active:bg-indigo-100 dark:border-indigo-900 dark:bg-zinc-900 dark:text-indigo-300 dark:hover:bg-zinc-800";

  const sidebarNavBtn =
    "w-full rounded-xl px-3 py-2.5 text-right text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-200/80 active:bg-zinc-300/80 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:active:bg-zinc-700";

  return (
    <div className="flex min-h-dvh w-full flex-col lg:flex-row">
      <aside
        className="hidden shrink-0 border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-56 lg:flex-col lg:overflow-y-auto lg:border-e"
        aria-label="תפריט צד"
      >
        <nav className="flex flex-col gap-1 p-4 pt-6">
          <Link href="/" className={sidebarNavBtn}>
            תכנון יומי
          </Link>
          <button
            type="button"
            className={sidebarNavBtn}
            onClick={() => setInviteModalOpen(true)}
          >
            הזמנת משתמשים
          </button>
          <p className="px-3 pt-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">נושאים</p>
          <div className="flex max-h-64 flex-col gap-1 overflow-y-auto overscroll-contain">
            {topics.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setFocusTopicId(t.id);
                  setHubTab("tasks");
                }}
                className={`w-full rounded-xl px-3 py-2.5 text-right text-sm font-medium transition-colors ${
                  focusTopicId === t.id
                    ? "bg-indigo-100 text-indigo-950 ring-2 ring-indigo-400 dark:bg-indigo-950/60 dark:text-indigo-100 dark:ring-indigo-700"
                    : "text-zinc-800 hover:bg-zinc-200/80 active:bg-zinc-300/80 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
                }`}
                style={focusTopicId === t.id ? undefined : topicLabelStyle(t)}
              >
                <span className="line-clamp-2 break-words">{t.title}</span>
              </button>
            ))}
          </div>
          <button type="button" className={sidebarNavBtn} onClick={() => setTopicsListModalOpen(true)}>
            ניהול נושאים…
          </button>
          <button type="button" className={sidebarNavBtn} onClick={() => void logout()}>
            יציאה
          </button>
        </nav>
      </aside>

      <div className="mx-auto flex w-full min-w-0 max-w-5xl flex-1 flex-col gap-4 px-3 py-4 sm:gap-6 sm:px-5 sm:py-8 lg:px-6">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 dark:border-zinc-800 sm:flex-row sm:items-start sm:justify-between sm:pb-6">
          <div className="min-w-0 ps-[4.75rem] lg:ps-0">
            <h1 className="text-xl font-bold text-zinc-900 sm:text-2xl dark:text-white">ניהול דברים</h1>
            <p className="mt-1 truncate text-sm text-zinc-500 sm:text-base">
              שלום, {user.name}
              {focusTopicId && (
                <>
                  {" "}
                  · {topics.find((x) => x.id === focusTopicId)?.title ?? ""}
                </>
              )}
            </p>
          </div>

          <div className="fixed top-[max(0.75rem,env(safe-area-inset-top))] right-[max(0.75rem,env(safe-area-inset-right))] z-40 lg:hidden">
            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreMenuOpen((o) => !o)}
                className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-2 text-lg leading-none text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                aria-expanded={moreMenuOpen}
                aria-haspopup="menu"
                title="תפריט"
              >
                ⋯
              </button>
              {moreMenuOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-30 cursor-default bg-transparent"
                    aria-label="סגירת תפריט"
                    onClick={() => setMoreMenuOpen(false)}
                  />
                  <div
                    className="absolute right-0 top-full z-40 mt-1 min-w-[12rem] rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
                    role="menu"
                  >
                    <Link
                      href="/"
                      role="menuitem"
                      className="block w-full px-4 py-2.5 text-right text-sm text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
                      onClick={() => setMoreMenuOpen(false)}
                    >
                      תכנון יומי
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      className="w-full px-4 py-2.5 text-right text-sm text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
                      onClick={() => {
                        setMoreMenuOpen(false);
                        setInviteModalOpen(true);
                      }}
                    >
                      הזמנת משתמשים
                    </button>
                    <div className="max-h-40 overflow-y-auto border-b border-zinc-100 px-2 py-1 dark:border-zinc-800">
                      <p className="px-2 py-1 text-xs text-zinc-500">נושאים</p>
                      {topics.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          role="menuitem"
                          className={`w-full rounded-lg px-2 py-2 text-right text-sm ${
                            focusTopicId === t.id
                              ? "bg-indigo-100 font-medium text-indigo-950 dark:bg-indigo-950/50 dark:text-indigo-100"
                              : "text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
                          }`}
                          onClick={() => {
                            setMoreMenuOpen(false);
                            setFocusTopicId(t.id);
                            setHubTab("tasks");
                          }}
                        >
                          {t.title}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      className="w-full px-4 py-2.5 text-right text-sm text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
                      onClick={() => {
                        setMoreMenuOpen(false);
                        setTopicsListModalOpen(true);
                      }}
                    >
                      ניהול נושאים…
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="w-full px-4 py-2.5 text-right text-sm text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
                      onClick={() => {
                        setMoreMenuOpen(false);
                        void logout();
                      }}
                    >
                      יציאה
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex w-full flex-shrink-0 justify-start sm:w-auto">
            <button type="button" onClick={openNewTask} className={`${btnPrimary} w-full sm:w-auto`}>
              מטלה חדשה
            </button>
          </div>
        </header>

      {focusTopicId && topics.length > 0 && (
        <div
          className="flex flex-wrap gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-800"
          role="tablist"
          aria-label="אזורים בנושא"
        >
          {(
            [
              ["tasks", "מטלות"],
              ["expenses", "הוצאות"],
              ["contacts", "אנשי מקצוע"],
              ["dates", "תאריכים"],
              ["shopping", "קניות"],
              ["packing", "לקחת"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={hubTab === id}
              onClick={() => setHubTab(id)}
              className={`min-h-10 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                hubTab === id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

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

      {focusTopicId && hubTab !== "tasks" && (
        <TopicHubSections
          topicId={focusTopicId}
          tab={hubTab}
          topicUsers={topics.find((t) => t.id === focusTopicId)?.users ?? []}
          onToast={(msg) => {
            setToast(msg);
            setTimeout(() => setToast(null), 3000);
          }}
          onError={setError}
        />
      )}

      {filterModalOpen && (
        <div
          className="fixed inset-0 z-[52] flex min-h-dvh min-h-[100svh] items-center justify-center overflow-y-auto overscroll-contain bg-black/40 p-3 sm:p-4"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && cancelFilterModal()}
        >
          <div className="relative my-auto w-full max-w-md max-h-[min(90dvh,640px)] overflow-y-auto overscroll-contain rounded-2xl bg-white p-4 shadow-xl sm:p-6 dark:bg-zinc-900">
            <div className="relative mb-4 flex min-h-9 items-center justify-center">
              <ModalCloseButton onClick={cancelFilterModal} />
              <h3 className="text-center text-base font-semibold sm:text-lg">סינון מטלות</h3>
            </div>
            <div className="mt-4 flex flex-col gap-4">
              {focusTopicId && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  המטלות מסוננות לפי הנושא הנבחר בסרגל הצד. בנושא נבחר מוצגות גם מטלות ללא נושא המשויכות אליך.
                </p>
              )}
              {focusTopicId && (
                <label className="flex cursor-pointer items-start gap-3 text-sm text-zinc-800 dark:text-zinc-200">
                  <input
                    type="checkbox"
                    checked={draftOnlyMyTasks}
                    onChange={(e) => setDraftOnlyMyTasks(e.target.checked)}
                    className="mt-0.5 size-5 shrink-0 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>
                    הצג רק מטלות שלי (משויכות אליי)
                    <span className="mt-1 block text-xs font-normal text-zinc-500 dark:text-zinc-400">
                      מסתיר מטלות של אחרים בנושא הנבחר (ללא שינוי במטלות ללא נושא המשויכות אליך).
                    </span>
                  </span>
                </label>
              )}
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    סינון לפי טווח תאריכים (מועד לביצוע או לביצוע עד)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftDateFrom("");
                      setDraftDateTo("");
                    }}
                    className="shrink-0 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    אפס טווח תאריכים
                  </button>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
                  <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
                    <span>מתאריך</span>
                    <input
                      type="date"
                      value={draftDateFrom}
                      onChange={(e) => setDraftDateFrom(e.target.value)}
                      className="min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base dark:border-zinc-600 dark:bg-zinc-900"
                    />
                  </label>
                  <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
                    <span>עד תאריך</span>
                    <input
                      type="date"
                      value={draftDateTo}
                      onChange={(e) => setDraftDateTo(e.target.value)}
                      className="min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base dark:border-zinc-600 dark:bg-zinc-900"
                    />
                  </label>
                </div>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
              <button
                type="button"
                onClick={removeAllTaskFilters}
                className="min-h-11 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                הסר כל הסינונים
              </button>
              <div className="flex justify-stretch sm:justify-end">
                <button
                  type="button"
                  onClick={applyTaskFilters}
                  className="min-h-11 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 sm:w-auto"
                >
                  החל
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {hubTab === "tasks" && (
      <section className="flex flex-col gap-3 sm:gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold sm:text-lg">מטלות</h2>
            <button
              type="button"
              onClick={openFilterModal}
              className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              title="סינון מטלות"
              aria-label="סינון מטלות"
            >
              <svg
                viewBox="0 0 24 24"
                className="size-[1.125rem] shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="6" y1="12" x2="18" y2="12" />
                <line x1="9" y1="18" x2="15" y2="18" />
              </svg>
            </button>
          </div>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={showCompletedTasks}
              onChange={(e) => setShowCompletedTasks(e.target.checked)}
              className="size-5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
            />
            הצג גם מטלות שבוצעו (בסוף הרשימה)
          </label>
        </div>
        <ul className="flex flex-col gap-3">
          {tasks.map((t) => {
            const prereqPending = t.prerequisites.some((p) => !p.done);
            const assignedToMe = t.assignedToMe ?? true;
            const cardClass = !assignedToMe
              ? t.done
                ? "rounded-2xl border border-dashed border-emerald-400/80 bg-emerald-50/70 p-3 opacity-95 shadow-sm transition-colors sm:p-4 dark:border-emerald-800 dark:bg-emerald-950/40"
                : "rounded-2xl border border-dashed border-amber-400/90 bg-amber-50/55 p-3 shadow-sm transition-colors sm:p-4 dark:border-amber-700 dark:bg-amber-950/35"
              : t.done
                ? "rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3 shadow-sm transition-colors sm:p-4 dark:border-emerald-900 dark:bg-emerald-950/30"
                : "rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm transition-colors sm:p-4 dark:border-zinc-800 dark:bg-zinc-900";
            return (
              <li key={t.id} className={cardClass}>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={t.done}
                    disabled={!assignedToMe}
                    onChange={(e) => toggleDone(t, e.target.checked)}
                    title={assignedToMe ? undefined : "רק משויכים למטלה יכולים לסמן ביצוע"}
                    className="mt-1 size-6 shrink-0 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={assignedToMe ? "בוצע" : "בוצע — לא משויך אלייך"}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                      <span
                        className={`break-words text-base font-semibold sm:text-lg ${t.done ? "text-zinc-500 line-through" : ""}`}
                      >
                        {t.title}
                      </span>
                      {!assignedToMe && (
                        <span className="rounded-full border border-amber-300 bg-amber-100/95 px-2 py-0.5 text-xs font-medium text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
                          לא משויך אליי
                        </span>
                      )}
                      {t.topic && (
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-medium shadow-sm"
                          style={topicLabelStyle(t.topic)}
                        >
                          {t.topic.title}
                        </span>
                      )}
                      {!t.topic && (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                          ללא נושא
                        </span>
                      )}
                    </div>
                    {t.description && (
                      <p className="mt-1 break-words text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                        {t.description}
                      </p>
                    )}
                    {(t.scheduledAt || t.dueAt) && (
                      <div className="mt-2 flex flex-col gap-1 text-xs text-zinc-500 sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-1">
                        {t.scheduledAt && (
                          <span className="break-words">מועד לביצוע: {formatHeDate(t.scheduledAt)}</span>
                        )}
                        {t.dueAt && (
                          <span className="break-words">לביצוע עד: {formatHeDate(t.dueAt)}</span>
                        )}
                      </div>
                    )}
                    {t.prerequisites.length > 0 && (
                      <div className="mt-2 break-words text-sm leading-relaxed">
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">תלויות: </span>
                        {t.prerequisites.map((p) => (
                          <span
                            key={p.id}
                            className={p.done ? "text-emerald-600" : prereqPending ? "text-amber-600" : ""}
                          >
                            {p.title}
                            {p.done ? " ✓" : " ○"}{" "}
                          </span>
                        ))}
                        {prereqPending && !t.done && (
                          <span className="mt-1 block text-amber-700 sm:mr-2 sm:mt-0 sm:inline dark:text-amber-400">
                            (יש להשלים תלויות לפני הביצוע)
                          </span>
                        )}
                      </div>
                    )}
                    <div className="mt-2 break-words text-xs text-zinc-500">
                      משויכים: {t.users.map((u) => u.name).join(", ")}
                    </div>
                    {assignedToMe && (
                      <div className="mt-3 flex flex-wrap gap-1 sm:gap-2">
                        <button
                          type="button"
                          onClick={() => openEditTask(t)}
                          className="min-h-9 min-w-[44px] touch-manipulation rounded-lg px-2 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 hover:underline active:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-zinc-800"
                        >
                          עריכה
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTask(t.id)}
                          className="min-h-9 min-w-[44px] touch-manipulation rounded-lg px-2 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 hover:underline active:bg-red-100 dark:hover:bg-zinc-800"
                        >
                          מחיקה
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {tasks.length === 0 && (
          <p className="text-zinc-500">אין מטלות להצגה בטווח הנבחר.</p>
        )}
      </section>
      )}

      {inviteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex min-h-dvh min-h-[100svh] items-center justify-center overflow-y-auto overscroll-contain bg-black/40 p-3 sm:p-4"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && setInviteModalOpen(false)}
        >
          <div className="my-auto w-full max-w-lg max-h-[min(92dvh,880px)] overflow-y-auto overscroll-contain rounded-2xl bg-white p-4 shadow-xl sm:p-6 dark:bg-zinc-900">
            <div className="relative mb-4 flex min-h-9 items-center justify-center">
              <ModalCloseButton onClick={() => setInviteModalOpen(false)} />
              <h3 className="text-center text-base font-semibold sm:text-lg">הזמנת משתמשים</h3>
            </div>
            <div className="flex flex-col gap-3">
              {inviteSending && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">יוצר קישור הזמנה…</p>
              )}
              {inviteError && (
                <p className="text-sm text-red-700 dark:text-red-300">{inviteError}</p>
              )}
              {!inviteSending && inviteUrl && (
                <>
                  <textarea
                    readOnly
                    value={inviteTextToCopy}
                    rows={Math.min(12, 4 + inviteTextToCopy.split("\n").length)}
                    className="w-full resize-y rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 font-sans text-sm leading-relaxed dark:border-zinc-600 dark:bg-zinc-800"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={copyInviteText}
                      className="min-h-11 touch-manipulation rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                    >
                      העתק טקסט
                    </button>
                    {copyInviteHint && (
                      <span className="text-sm text-emerald-700 dark:text-emerald-400">{copyInviteHint}</span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {topicsListModalOpen && (
        <div
          className="fixed inset-0 z-[55] flex min-h-dvh min-h-[100svh] items-center justify-center overflow-y-auto overscroll-contain bg-black/40 p-3 sm:p-4"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && setTopicsListModalOpen(false)}
        >
          <div className="my-auto w-full max-w-lg max-h-[min(88dvh,720px)] overflow-y-auto overscroll-contain rounded-2xl bg-white p-4 shadow-xl sm:p-6 dark:bg-zinc-900">
            <div className="relative mb-4 pl-10">
              <ModalCloseButton align="top" onClick={() => setTopicsListModalOpen(false)} />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <h3 className="text-base font-semibold sm:text-lg">נושאים</h3>
                <button
                  type="button"
                  onClick={openNewTopicModal}
                  className={`${btnSecondary} w-full shrink-0 sm:w-auto`}
                >
                  נושא חדש
                </button>
              </div>
            </div>
            <ul className="mt-4 flex flex-col gap-2">
              {topics.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center gap-x-2 gap-y-2 rounded-xl border border-zinc-200/80 px-3 py-2.5 text-sm sm:flex-nowrap dark:border-zinc-600"
                  style={topicLabelStyle(t)}
                >
                  <span className="min-w-0 flex-1 break-words font-medium">{t.title}</span>
                  <span className="shrink-0 opacity-90">({t.taskCount})</span>
                  <div className="flex w-full shrink-0 justify-end gap-2 sm:mr-auto sm:w-auto sm:justify-start">
                    <button
                      type="button"
                      className="min-h-9 min-w-[44px] touch-manipulation rounded-md bg-white/25 px-2 py-1 font-medium hover:bg-white/40 hover:underline active:bg-white/50 dark:bg-black/20 dark:hover:bg-black/35"
                      onClick={() => openEditTopic(t)}
                    >
                      עריכה
                    </button>
                    <button
                      type="button"
                      className="min-h-9 min-w-[44px] touch-manipulation rounded-md bg-white/25 px-2 py-1 font-medium text-red-900 hover:bg-red-100/90 hover:underline active:bg-red-200/90 dark:text-red-100 dark:hover:bg-red-950/50"
                      onClick={() => void deleteTopic(t.id)}
                    >
                      מחיקה
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {topics.length === 0 && (
              <p className="mt-4 text-sm text-zinc-500">אין נושאים עדיין.</p>
            )}
          </div>
        </div>
      )}

      {topicModal && (
        <div
          className="fixed inset-0 z-[60] flex min-h-dvh min-h-[100svh] items-center justify-center overflow-y-auto overscroll-contain bg-black/40 p-3 sm:p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setTopicModal(false);
              setTopicModalForTask(false);
            }
          }}
        >
          <div className="my-auto w-full max-w-md max-h-[min(90dvh,720px)] overflow-y-auto overscroll-contain rounded-2xl bg-white p-4 shadow-xl sm:p-6 dark:bg-zinc-900">
            <div className="relative mb-4 flex min-h-9 items-center justify-center">
              <ModalCloseButton
                onClick={() => {
                  setTopicModal(false);
                  setTopicModalForTask(false);
                }}
              />
              <h3 className="text-center text-base font-semibold sm:text-lg">נושא חדש</h3>
            </div>
            <form onSubmit={submitTopic} className="flex flex-col gap-3">
              <input
                required
                placeholder="שם הנושא"
                value={topicTitle}
                onChange={(e) => setTopicTitle(e.target.value)}
                className="min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-600 dark:bg-zinc-800"
              />
              <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  <input
                    type="checkbox"
                    checked={topicColorAuto}
                    onChange={(e) => setTopicColorAuto(e.target.checked)}
                    className="size-5 shrink-0"
                  />
                  צבע אוטומטי (האתר יבחר צבע ייחודי)
                </label>
                {!topicColorAuto && (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <input
                      type="color"
                      value={topicColorHex}
                      onChange={(e) => setTopicColorHex(e.target.value)}
                      className="h-11 w-16 min-w-[3.5rem] cursor-pointer rounded-lg border border-zinc-300 bg-white p-1 dark:border-zinc-600"
                      aria-label="בחירת צבע לנושא"
                    />
                    <span className="font-mono text-sm text-zinc-600 dark:text-zinc-400">{topicColorHex}</span>
                  </div>
                )}
              </div>
              <div>
                <p className="mb-1 text-sm text-zinc-600">שיוך למשתמשים</p>
                <div className="max-h-40 space-y-1 overflow-y-auto overscroll-contain rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
                  {allUsers.map((u) => (
                    <label key={u.id} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm touch-manipulation">
                      <input
                        type="checkbox"
                        checked={topicUserIds.includes(u.id)}
                        onChange={(e) => {
                          const on = e.target.checked;
                          setTopicUserIds((prev) =>
                            on ? (prev.includes(u.id) ? prev : [...prev, u.id]) : prev.filter((x) => x !== u.id)
                          );
                        }}
                        className="size-5 shrink-0"
                      />
                      <span className="min-w-0 break-words">
                        {u.name} ({u.email})
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="mt-2 flex justify-stretch pt-2 sm:justify-end">
                <button
                  type="submit"
                  className="min-h-11 w-full touch-manipulation rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 sm:w-auto"
                >
                  שמירה
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingTopicId && (
        <div
          className="fixed inset-0 z-[65] flex min-h-dvh min-h-[100svh] items-center justify-center overflow-y-auto overscroll-contain bg-black/40 p-3 sm:p-4"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && setEditingTopicId(null)}
        >
          <div className="my-auto w-full max-w-md max-h-[min(90dvh,720px)] overflow-y-auto overscroll-contain rounded-2xl bg-white p-4 shadow-xl sm:p-6 dark:bg-zinc-900">
            <div className="relative mb-4 flex min-h-9 items-center justify-center">
              <ModalCloseButton onClick={() => setEditingTopicId(null)} />
              <h3 className="text-center text-base font-semibold sm:text-lg">עריכת נושא</h3>
            </div>
            <form onSubmit={submitEditTopic} className="flex flex-col gap-3">
              <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                שם
                <input
                  required
                  value={editTopicTitle}
                  onChange={(e) => setEditTopicTitle(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-600 dark:bg-zinc-800"
                />
              </label>
              <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  <input
                    type="checkbox"
                    checked={editTopicColorAuto}
                    onChange={(e) => setEditTopicColorAuto(e.target.checked)}
                    className="size-5 shrink-0"
                  />
                  צבע אוטומטי (האתר יבחר צבע ייחודי)
                </label>
                {!editTopicColorAuto && (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <input
                      type="color"
                      value={editTopicColorHex}
                      onChange={(e) => setEditTopicColorHex(e.target.value)}
                      className="h-11 w-16 min-w-[3.5rem] cursor-pointer rounded-lg border border-zinc-300 bg-white p-1 dark:border-zinc-600"
                      aria-label="בחירת צבע לנושא"
                    />
                    <span className="font-mono text-sm text-zinc-600 dark:text-zinc-400">{editTopicColorHex}</span>
                  </div>
                )}
              </div>
              <div>
                <p className="mb-1 text-sm text-zinc-600 dark:text-zinc-300">שיוך למשתמשים</p>
                <div className="max-h-40 space-y-1 overflow-y-auto overscroll-contain rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
                  {allUsers.map((u) => (
                    <label key={u.id} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm touch-manipulation">
                      <input
                        type="checkbox"
                        checked={editTopicUserIds.includes(u.id)}
                        onChange={(e) => {
                          const on = e.target.checked;
                          setEditTopicUserIds((prev) =>
                            on ? (prev.includes(u.id) ? prev : [...prev, u.id]) : prev.filter((x) => x !== u.id)
                          );
                        }}
                        className="size-5 shrink-0"
                      />
                      <span className="min-w-0 break-words">
                        {u.name} ({u.email})
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="mt-2 flex justify-stretch pt-2 sm:justify-end">
                <button
                  type="submit"
                  className="min-h-11 w-full touch-manipulation rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 sm:w-auto"
                >
                  שמירה
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {taskModal && (
        <div
          className="fixed inset-0 z-50 flex min-h-dvh min-h-[100svh] items-center justify-center overflow-y-auto overscroll-contain bg-black/40 p-3 sm:p-4"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && setTaskModal(false)}
        >
          <div className="my-auto w-full max-w-lg max-h-[min(92dvh,840px)] overflow-y-auto overscroll-contain rounded-2xl bg-white p-4 shadow-xl sm:p-6 dark:bg-zinc-900">
            <div className="relative mb-4 flex min-h-9 items-center justify-center">
              <ModalCloseButton onClick={() => setTaskModal(false)} />
              <h3 className="text-center text-base font-semibold sm:text-lg">
                {editTaskId ? "עריכת מטלה" : "מטלה חדשה"}
              </h3>
            </div>
            <form onSubmit={submitTask} className="flex flex-col gap-3">
              <input
                required
                placeholder="כותרת"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                autoFocus={!editTaskId}
                className="min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-600 dark:bg-zinc-800"
              />
              <textarea
                placeholder="תיאור (אופציונלי)"
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                rows={3}
                className="min-h-[5rem] w-full rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-600 dark:bg-zinc-800"
              />
              {editTaskId ? (
                <label className="text-sm">
                  נושא
                  <select
                    value={taskTopicId}
                    onChange={(e) => setTaskTopicId(e.target.value)}
                    className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-600 dark:bg-zinc-800 sm:text-sm"
                  >
                    <option value="">ללא נושא</option>
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-2">
                  <label className="min-w-0 flex-1 text-sm">
                    <span className="block">נושא</span>
                    <select
                      value={taskTopicId}
                      onChange={(e) => setTaskTopicId(e.target.value)}
                      className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-600 dark:bg-zinc-800 sm:text-sm"
                    >
                      <option value="">ללא נושא</option>
                      {topics.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={openTopicModalFromTask}
                    className={`${btnSecondary} min-h-11 w-full shrink-0 sm:w-auto`}
                  >
                    נושא חדש
                  </button>
                </div>
              )}
              <label className="text-sm">
                מועד לביצוע
                <input
                  type="datetime-local"
                  value={taskScheduled}
                  onChange={(e) => setTaskScheduled(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-600 dark:bg-zinc-800 sm:text-sm"
                />
              </label>
              <label className="text-sm">
                לביצוע עד
                <input
                  type="datetime-local"
                  value={taskDue}
                  onChange={(e) => setTaskDue(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-600 dark:bg-zinc-800 sm:text-sm"
                />
              </label>
              <div>
                <p className="mb-1 text-sm text-zinc-600">משויכים למטלה</p>
                <div className="max-h-32 space-y-1 overflow-y-auto overscroll-contain rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
                  {allUsers.map((u) => (
                    <label key={u.id} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm touch-manipulation">
                      <input
                        type="checkbox"
                        checked={taskUserIds.includes(u.id)}
                        onChange={(e) => {
                          const on = e.target.checked;
                          setTaskUserIds((prev) =>
                            on ? (prev.includes(u.id) ? prev : [...prev, u.id]) : prev.filter((x) => x !== u.id)
                          );
                        }}
                        className="size-5 shrink-0"
                      />
                      <span className="min-w-0 break-words">{u.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-sm text-zinc-600 dark:text-zinc-300">
                  תלויות (יש להשלים לפני המטלה הנוכחית)
                </p>
                {taskPrereqIds.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {taskPrereqIds.map((id) => {
                      const p = tasks.find((t) => t.id === id);
                      if (!p) return null;
                      return (
                        <span
                          key={id}
                          className="inline-flex max-w-full items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
                        >
                          <span className="min-w-0 truncate">{p.title}</span>
                          <button
                            type="button"
                            className="shrink-0 rounded p-0.5 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                            aria-label={`הסר תלות: ${p.title}`}
                            onClick={() => setTaskPrereqIds((prev) => prev.filter((x) => x !== id))}
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setTaskPrereqModalOpen(true)}
                  className={`${btnSecondary} w-full sm:w-auto`}
                >
                  {taskPrereqIds.length ? "עריכת תלויות…" : "בחר תלויות…"}
                </button>
              </div>
              <div className="mt-2 flex justify-stretch pt-2 sm:justify-end">
                <button
                  type="submit"
                  className="min-h-11 w-full touch-manipulation rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 sm:w-auto"
                >
                  שמירה
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {taskModal && taskPrereqModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex min-h-dvh min-h-[100svh] items-center justify-center overflow-y-auto overscroll-contain bg-black/40 p-3 sm:p-4"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && setTaskPrereqModalOpen(false)}
        >
          <div className="my-auto w-full max-w-md max-h-[min(85dvh,560px)] overflow-y-auto overscroll-contain rounded-2xl bg-white p-4 shadow-xl sm:p-6 dark:bg-zinc-900">
            <div className="relative mb-4 flex min-h-9 items-center justify-center">
              <ModalCloseButton onClick={() => setTaskPrereqModalOpen(false)} />
              <h3 className="text-center text-base font-semibold sm:text-lg">תלויות</h3>
            </div>
            <p className="mb-3 text-center text-sm text-zinc-600 dark:text-zinc-400">
              בחרו מטלות שיש להשלים לפני המטלה הנוכחית (ניתן לבחור כמה).
            </p>
            <div className="max-h-[min(45dvh,320px)] space-y-1 overflow-y-auto overscroll-contain rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
              {prereqOptions.map((p) => (
                <label key={p.id} className="flex min-h-11 cursor-pointer items-start gap-2 text-sm touch-manipulation">
                  <input
                    type="checkbox"
                    checked={taskPrereqIds.includes(p.id)}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setTaskPrereqIds((prev) =>
                        on ? (prev.includes(p.id) ? prev : [...prev, p.id]) : prev.filter((x) => x !== p.id)
                      );
                    }}
                    className="mt-0.5 size-5 shrink-0"
                  />
                  <span className="min-w-0 break-words">{p.title}</span>
                </label>
              ))}
              {prereqOptions.length === 0 && (
                <p className="px-1 py-2 text-center text-sm text-zinc-400">אין מטלות אחרות לבחירה</p>
              )}
            </div>
            <div className="mt-4 flex justify-stretch sm:justify-end">
              <button
                type="button"
                onClick={() => setTaskPrereqModalOpen(false)}
                className="min-h-11 w-full touch-manipulation rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 sm:w-auto"
              >
                סיום
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
