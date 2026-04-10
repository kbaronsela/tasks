"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";

type User = { id: string; name: string; email: string };

type Topic = {
  id: string;
  title: string;
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
  topic: { id: string; title: string } | null;
  users: User[];
  prerequisites: { id: string; title: string; done: boolean }[];
};

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
  };

  const submitEditTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTopicId) return;
    const r = await fetch(`/api/topics/${editingTopicId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTopicTitle, userIds: editTopicUserIds }),
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
      <div className="flex min-h-screen items-center justify-center text-zinc-500">
        טוען…
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-6 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">המטלות שלי</h1>
          <p className="text-sm text-zinc-500">שלום, {user.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setTopicUserIds([user.id]);
              setTopicTitle("");
              setTopicModal(true);
            }}
            className="rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-700 shadow-sm hover:bg-indigo-50 dark:border-indigo-900 dark:bg-zinc-900 dark:text-indigo-300 dark:hover:bg-zinc-800"
          >
            נושא חדש
          </button>
          <button
            type="button"
            onClick={openNewTask}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
          >
            מטלה חדשה
          </button>
          <button
            type="button"
            onClick={logout}
            className="rounded-xl px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
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

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-lg font-semibold">נושאים</h2>
        <div className="flex flex-wrap gap-2">
          {topics.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            >
              <span className="font-medium">{t.title}</span>
              <span className="text-zinc-400">({t.taskCount})</span>
              <button
                type="button"
                className="text-indigo-600 hover:underline dark:text-indigo-400"
                onClick={() => openEditTopic(t)}
              >
                עריכה
              </button>
              <button
                type="button"
                className="text-red-600 hover:underline dark:text-red-400"
                onClick={() => deleteTopic(t.id)}
              >
                מחיקה
              </button>
            </div>
          ))}
          {topics.length === 0 && (
            <p className="text-sm text-zinc-500">עדיין אין נושאים — צרי נושא חדש.</p>
          )}
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          סינון לפי נושא
          <select
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
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

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">מטלות</h2>
        <ul className="flex flex-col gap-3">
          {tasks.map((t) => {
            const prereqPending = t.prerequisites.some((p) => !p.done);
            return (
              <li
                key={t.id}
                className={`rounded-2xl border p-4 shadow-sm transition-colors ${
                  t.done
                    ? "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/30"
                    : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                }`}
              >
                <div className="flex flex-wrap items-start gap-3">
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={(e) => toggleDone(t, e.target.checked)}
                    className="mt-1 size-5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    aria-label="בוצע"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-lg font-semibold ${t.done ? "text-zinc-500 line-through" : ""}`}>
                        {t.title}
                      </span>
                      {t.topic && (
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">
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
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-zinc-500">
                      <span>מועד ביצוע: {formatHeDate(t.scheduledAt)}</span>
                      <span>דד ליין: {formatHeDate(t.dueAt)}</span>
                    </div>
                    {t.prerequisites.length > 0 && (
                      <div className="mt-2 text-sm">
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
                          <span className="mr-2 text-amber-700 dark:text-amber-400">
                            (יש להשלים תלויות לפני הביצוע)
                          </span>
                        )}
                      </div>
                    )}
                    <div className="mt-2 text-xs text-zinc-500">
                      משויכים: {t.users.map((u) => u.name).join(", ")}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openEditTask(t)}
                        className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        עריכה
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTask(t.id)}
                        className="text-sm font-medium text-red-600 hover:underline"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h3 className="text-lg font-semibold">נושא חדש</h3>
            <form onSubmit={submitTopic} className="mt-4 flex flex-col gap-3">
              <input
                required
                placeholder="שם הנושא"
                value={topicTitle}
                onChange={(e) => setTopicTitle(e.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
              />
              <div>
                <p className="mb-1 text-sm text-zinc-600">שיוך למשתמשים</p>
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
                  {allUsers.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={topicUserIds.includes(u.id)}
                        onChange={() =>
                          setTopicUserIds((prev) =>
                            prev.includes(u.id) ? prev.filter((x) => x !== u.id) : [...prev, u.id]
                          )
                        }
                      />
                      {u.name} ({u.email})
                    </label>
                  ))}
                </div>
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTopicModal(false)}
                  className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                >
                  שמירה
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {taskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h3 className="text-lg font-semibold">{editTaskId ? "עריכת מטלה" : "מטלה חדשה"}</h3>
            <form onSubmit={submitTask} className="mt-4 flex flex-col gap-3">
              <input
                required
                placeholder="כותרת"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
              />
              <textarea
                placeholder="תיאור (אופציונלי)"
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                rows={3}
                className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
              />
              <label className="text-sm">
                נושא
                <select
                  value={taskTopicId}
                  onChange={(e) => setTaskTopicId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
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
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
                />
              </label>
              <label className="text-sm">
                דד ליין
                <input
                  type="datetime-local"
                  value={taskDue}
                  onChange={(e) => setTaskDue(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
                />
              </label>
              <div>
                <p className="mb-1 text-sm text-zinc-600">משויכים למטלה</p>
                <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
                  {allUsers.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={taskUserIds.includes(u.id)}
                        onChange={() =>
                          setTaskUserIds((prev) =>
                            prev.includes(u.id) ? prev.filter((x) => x !== u.id) : [...prev, u.id]
                          )
                        }
                      />
                      {u.name}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-sm text-zinc-600">תלויות (יש להשלים לפני המטלה הנוכחית)</p>
                <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
                  {prereqOptions.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={taskPrereqIds.includes(p.id)}
                        onChange={() =>
                          setTaskPrereqIds((prev) =>
                            prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                          )
                        }
                      />
                      {p.title}
                    </label>
                  ))}
                  {prereqOptions.length === 0 && (
                    <p className="text-xs text-zinc-400">אין מטלות אחרות לבחירה</p>
                  )}
                </div>
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTaskModal(false)}
                  className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                >
                  שמירה
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingTopicId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h3 className="text-lg font-semibold">עריכת נושא</h3>
            <form onSubmit={submitEditTopic} className="mt-4 flex flex-col gap-3">
              <input
                required
                value={editTopicTitle}
                onChange={(e) => setEditTopicTitle(e.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
              />
              <div>
                <p className="mb-1 text-sm text-zinc-600">שיוך למשתמשים</p>
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
                  {allUsers.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editTopicUserIds.includes(u.id)}
                        onChange={() =>
                          setEditTopicUserIds((prev) =>
                            prev.includes(u.id) ? prev.filter((x) => x !== u.id) : [...prev, u.id]
                          )
                        }
                      />
                      {u.name}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTopicId(null)}
                  className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
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
