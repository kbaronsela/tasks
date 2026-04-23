"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data.error ?? "התחברות נכשלה");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-dvh min-h-[100svh] flex-col items-center justify-center px-4 py-8 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-center text-xl font-bold sm:text-2xl">התחברות</h1>
        <p className="mt-2 text-center text-sm text-zinc-500">מה היום?</p>
        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-200">
              {error}
            </div>
          )}
          <label className="block text-sm font-medium">
            אימייל
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-600 dark:bg-zinc-800"
            />
          </label>
          <label className="block text-sm font-medium">
            סיסמה
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-600 dark:bg-zinc-800"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 w-full touch-manipulation rounded-xl bg-indigo-600 py-2.5 text-base font-medium text-white hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-60"
          >
            {pending ? "מתחבר…" : "כניסה"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-zinc-600">
          אין לך חשבון?{" "}
          <Link href="/register" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            הרשמה
          </Link>
        </p>
      </div>
    </div>
  );
}
