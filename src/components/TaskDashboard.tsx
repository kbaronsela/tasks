"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { contrastOnBackground, resolveTopicColor } from "@/lib/topic-color";

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

function formatHeDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function TaskDashboard({ user }: { user: User & { id: string } }) {
  const router = useRouter();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [topicFilter, setTopicFilter] = useState<string>("all");
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

  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editTopicTitle, setEditTopicTitle] = useState("");
  const [editTopicUserIds, setEditTopicUserIds] = useState<string[]>([]);
  const [editTopicColorAuto, setEditTopicColorAuto] = useState(true);
  const [editTopicColorHex, setEditTopicColorHex] = useState("#6366f1");

  const loadTopics = useCallback(async () => {
    const r = await fetch("/api/topics");
    if (!r.ok) throw new Error("טעינת נושאים נכשלה");
    const data = await r.json();
    setTopics(data.topics);
  }, []);

  const loadTasks = useCallback(async () => {
    const q = topicFilter === "all" ? "" : `?topic=${encodeURIComponent(topicFilter)}`;
    const r = await fetch(`/api/tasks${q}`);
    if (!r.ok) throw new Error("טעינת מטלות נכשלה");
    const data = await r.json();
    setTasks(data.tasks);
  }, [topicFilter]);

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

  const openNewTask = () => {
    setEditTaskId(null);
    setTaskTitle("");
    setTaskDescription("");
    setTaskTopicId("");
    setTaskScheduled("");
    setTaskDue("");
    setTaskUserIds([user.id]);
    setTaskPrereqIds([]);
    setTaskModal(true);
  };

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
    const r = await fetch("/api/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: topicTitle,
        userIds: topicUserIds.length ? topicUserIds : [user.id],
        color: topicColorAuto ? null : topicColorHex,
      }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j.error ?? "שמירה נכשלה");
      return;
    }
    setTopicModal(false);
    setTopicTitle("");
    setTopicUserIds([]);
    setTopicColorAuto(true);
    setTopicColorHex("#6366f1");
    await loadTopics();
    setToast("הנושא נוצר בהצלחה");
    setTimeout(() => setToast(null), 3000);
  };

  const submitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload = {
      title: taskTitle,
      description: taskDescription || null,
      topicId: taskTopicId || null,
      scheduledAt: taskScheduled || null,
      dueAt: taskDue || null,
      userIds: taskUserIds.length ? taskUserIds : [user.id],
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

  const deleteTopic = async (id: string) => {
    if (!confirm("למחוק את הנושא? המטלות יישארו ללא נושא.")) return;
    const r = await fetch(`/api/topics/${id}`, { method: "DELETE" });
    if (!r.ok) {
      setError("מחיקה נכשלה");
      return;
    }
    if (topicFilter === id) setTopicFilter("all");
    await loadTopics();
    await loadTasks();
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
    const r = await fetch(`/api/topics/${editingTopicId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editTopicTitle,
        userIds: editTopicUserIds,
        color: editTopicColorAuto ? null : editTopicColorHex,
      }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j.error ?? "שמירה נכשלה");
      return;
    }
    setEditingTopicId(null);
    await loadTopics();
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const prereqOptions = useMemo(() => {
    return tasks.filter((x) => x.id !== editTaskId);
  }, [tasks, editTaskId]);

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
  const btnGhost =
    "inline-flex min-h-11 min-w-[44px] touch-manipulation items-center justify-center rounded-xl px-4 py-2.5 text-sm text-zinc-600 hover:bg-zinc-100 active:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-3 py-4 sm:gap-6 sm:px-5 sm:py-8 lg:px-6">
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 dark:border-zinc-800 sm:flex-row sm:items-start sm:justify-between sm:pb-6">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-zinc-900 sm:text-2xl dark:text-white">המטלות שלי</h1>
          <p className="mt-1 truncate text-sm text-zinc-500 sm:text-base">שלום, {user.name}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-shrink-0 sm:flex-wrap sm:justify-end sm:gap-2">
          <button
            type="button"
            onClick={() => {
              setTopicUserIds([user.id]);
              setTopicTitle("");
              setTopicColorAuto(true);
              setTopicColorHex("#6366f1");
              setTopicModal(true);
            }}
            className={`${btnSecondary} col-span-1 w-full sm:w-auto`}
          >
            נושא חדש
          </button>
          <button type="button" onClick={openNewTask} className={`${btnPrimary} col-span-1 w-full sm:w-auto`}>
            מטלה חדשה
          </button>
          <button type="button" onClick={logout} className={`${btnGhost} col-span-2 w-full sm:col-span-1 sm:w-auto`}>
            יציאה
          </button>
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

      <section className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm sm:p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-base font-semibold sm:text-lg">נושאים</h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
          {topics.map((t) => (
            <div
              key={t.id}
              className="flex w-full flex-wrap items-center gap-x-2 gap-y-2 rounded-lg border border-zinc-200/80 px-3 py-2 text-sm sm:min-w-0 sm:max-w-full sm:flex-[1_1_16rem] dark:border-zinc-600"
              style={topicLabelStyle(t)}
            >
              <span className="min-w-0 flex-1 break-words font-medium">{t.title}</span>
              <span className="shrink-0 opacity-80">({t.taskCount})</span>
              <div className="flex w-full shrink-0 justify-end gap-2 sm:ml-auto sm:w-auto sm:justify-start">
                <button
                  type="button"
                  className="min-h-9 min-w-[44px] touch-manipulation rounded-md bg-white/25 px-2 py-1 font-medium hover:bg-white/40 hover:underline active:bg-white/50 dark:bg-black/20 dark:hover:bg-black/35"
                  onClick={() => openEditTopic(t)}
                >
                  עריכה
                </button>
                <button
                  type="button"
                  className="min-h-9 min-w-[44px] touch-manipulation rounded-md bg-white/25 px-2 py-1 font-medium text-red-800 hover:bg-red-100/90 hover:underline active:bg-red-200/90 dark:text-red-200 dark:hover:bg-red-950/50"
                  onClick={() => deleteTopic(t.id)}
                >
                  מחיקה
                </button>
              </div>
            </div>
          ))}
          {topics.length === 0 && (
            <p className="text-sm text-zinc-500">עדיין אין נושאים — צרי נושא חדש.</p>
          )}
        </div>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex w-full flex-col gap-2 text-sm font-medium text-zinc-700 sm:w-auto sm:flex-row sm:items-center sm:gap-3 dark:text-zinc-300">
          <span className="shrink-0">סינון לפי נושא</span>
          <select
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value)}
            className="min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base sm:min-w-[14rem] sm:text-sm dark:border-zinc-600 dark:bg-zinc-900"
          >
            <option value="all">הכל</option>
            <option value="none">ללא נושא</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="flex flex-col gap-3 sm:gap-4">
        <h2 className="text-base font-semibold sm:text-lg">מטלות</h2>
        <ul className="flex flex-col gap-3">
          {tasks.map((t) => {
            const prereqPending = t.prerequisites.some((p) => !p.done);
            return (
              <li
                key={t.id}
                className={`rounded-2xl border p-3 shadow-sm transition-colors sm:p-4 ${
                  t.done
                    ? "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/30"
                    : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={(e) => toggleDone(t, e.target.checked)}
                    className="mt-1 size-6 shrink-0 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    aria-label="בוצע"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                      <span
                        className={`break-words text-base font-semibold sm:text-lg ${t.done ? "text-zinc-500 line-through" : ""}`}
                      >
                        {t.title}
                      </span>
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
                    <div className="mt-2 flex flex-col gap-1 text-xs text-zinc-500 sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-1">
                      <span className="break-words">מועד ביצוע: {formatHeDate(t.scheduledAt)}</span>
                      <span className="break-words">דד ליין: {formatHeDate(t.dueAt)}</span>
                    </div>
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

      {topicModal && (
        <div
          className="fixed inset-0 z-50 flex min-h-dvh min-h-[100svh] items-center justify-center overflow-y-auto overscroll-contain bg-black/40 p-3 sm:p-4"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && setTopicModal(false)}
        >
          <div className="my-auto w-full max-w-md max-h-[min(90dvh,720px)] overflow-y-auto overscroll-contain rounded-2xl bg-white p-4 shadow-xl sm:p-6 dark:bg-zinc-900">
            <h3 className="text-base font-semibold sm:text-lg">נושא חדש</h3>
            <form onSubmit={submitTopic} className="mt-4 flex flex-col gap-3">
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
                        onChange={() =>
                          setTopicUserIds((prev) =>
                            prev.includes(u.id) ? prev.filter((x) => x !== u.id) : [...prev, u.id]
                          )
                        }
                        className="size-5 shrink-0"
                      />
                      <span className="min-w-0 break-words">
                        {u.name} ({u.email})
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="mt-2 flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setTopicModal(false)}
                  className="min-h-11 w-full touch-manipulation rounded-lg px-4 py-2.5 text-sm text-zinc-600 hover:bg-zinc-100 sm:w-auto dark:hover:bg-zinc-800"
                >
                  ביטול
                </button>
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
            <h3 className="text-base font-semibold sm:text-lg">
              {editTaskId ? "עריכת מטלה" : "מטלה חדשה"}
            </h3>
            <form onSubmit={submitTask} className="mt-4 flex flex-col gap-3">
              <input
                required
                placeholder="כותרת"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                className="min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-600 dark:bg-zinc-800"
              />
              <textarea
                placeholder="תיאור (אופציונלי)"
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                rows={3}
                className="min-h-[5rem] w-full rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-600 dark:bg-zinc-800"
              />
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
              <label className="text-sm">
                מועד ביצוע
                <input
                  type="datetime-local"
                  value={taskScheduled}
                  onChange={(e) => setTaskScheduled(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-600 dark:bg-zinc-800 sm:text-sm"
                />
              </label>
              <label className="text-sm">
                דד ליין
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
                        onChange={() =>
                          setTaskUserIds((prev) =>
                            prev.includes(u.id) ? prev.filter((x) => x !== u.id) : [...prev, u.id]
                          )
                        }
                        className="size-5 shrink-0"
                      />
                      <span className="min-w-0 break-words">{u.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-sm text-zinc-600">תלויות (יש להשלים לפני המטלה הנוכחית)</p>
                <div className="max-h-32 space-y-1 overflow-y-auto overscroll-contain rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
                  {prereqOptions.map((p) => (
                    <label key={p.id} className="flex min-h-11 cursor-pointer items-start gap-2 text-sm touch-manipulation">
                      <input
                        type="checkbox"
                        checked={taskPrereqIds.includes(p.id)}
                        onChange={() =>
                          setTaskPrereqIds((prev) =>
                            prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                          )
                        }
                        className="mt-0.5 size-5 shrink-0"
                      />
                      <span className="min-w-0 break-words">{p.title}</span>
                    </label>
                  ))}
                  {prereqOptions.length === 0 && (
                    <p className="text-xs text-zinc-400">אין מטלות אחרות לבחירה</p>
                  )}
                </div>
              </div>
              <div className="mt-2 flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setTaskModal(false)}
                  className="min-h-11 w-full touch-manipulation rounded-lg px-4 py-2.5 text-sm text-zinc-600 hover:bg-zinc-100 sm:w-auto dark:hover:bg-zinc-800"
                >
                  ביטול
                </button>
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
          className="fixed inset-0 z-50 flex min-h-dvh min-h-[100svh] items-center justify-center overflow-y-auto overscroll-contain bg-black/40 p-3 sm:p-4"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && setEditingTopicId(null)}
        >
          <div className="my-auto w-full max-w-md max-h-[min(90dvh,720px)] overflow-y-auto overscroll-contain rounded-2xl bg-white p-4 shadow-xl sm:p-6 dark:bg-zinc-900">
            <h3 className="text-base font-semibold sm:text-lg">עריכת נושא</h3>
            <form onSubmit={submitEditTopic} className="mt-4 flex flex-col gap-3">
              <input
                required
                value={editTopicTitle}
                onChange={(e) => setEditTopicTitle(e.target.value)}
                className="min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-600 dark:bg-zinc-800"
              />
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
                <p className="mb-1 text-sm text-zinc-600">שיוך למשתמשים</p>
                <div className="max-h-40 space-y-1 overflow-y-auto overscroll-contain rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
                  {allUsers.map((u) => (
                    <label key={u.id} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm touch-manipulation">
                      <input
                        type="checkbox"
                        checked={editTopicUserIds.includes(u.id)}
                        onChange={() =>
                          setEditTopicUserIds((prev) =>
                            prev.includes(u.id) ? prev.filter((x) => x !== u.id) : [...prev, u.id]
                          )
                        }
                        className="size-5 shrink-0"
                      />
                      <span className="min-w-0 break-words">{u.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setEditingTopicId(null)}
                  className="min-h-11 w-full touch-manipulation rounded-lg px-4 py-2.5 text-sm text-zinc-600 hover:bg-zinc-100 sm:w-auto dark:hover:bg-zinc-800"
                >
                  ביטול
                </button>
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
    </div>
  );
}
