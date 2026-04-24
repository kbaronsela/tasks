"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailLocked, setEmailLocked] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const token = searchParams.get("invite")?.trim();
    if (!token) return;
    setInviteToken(token);
    let cancelled = false;
    (async () => {
      const r = await fetch(`/api/invitations/validate?token=${encodeURIComponent(token)}`);
      const data = await r.json().catch(() => ({}));
      if (cancelled) return;
      if (data.valid) {
        if (data.email) {
          setEmail(String(data.email).toLowerCase());
          setEmailLocked(true);
        } else {
          setEmail("");
          setEmailLocked(false);
        }
        setInviteError(null);
      } else {
        setInviteToken(null);
        setInviteError(data.error ?? "ההזמנה לא תקפה או שפגה");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const r = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          ...(inviteToken ? { inviteToken } : {}),
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data.error ?? "ההרשמה נכשלה");
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
        <h1 className="text-center text-xl font-bold sm:text-2xl">הרשמה</h1>
        {inviteError && (
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
            {inviteError} — אפשר להירשם בלי קישור הזמנה (אם המערכת מאפשרת).
          </div>
        )}
        <a
          href="/api/auth/google"
          className="mt-6 flex min-h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white py-2.5 text-base font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          <svg className="size-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          המשך עם גוגל
        </a>
        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
          <span className="text-xs text-zinc-500">או הרשמה באימייל</span>
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-200">
              {error}
            </div>
          )}
          <label className="block text-sm font-medium">
            שם
            <input
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-600 dark:bg-zinc-800"
            />
          </label>
          <label className="block text-sm font-medium">
            אימייל
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              readOnly={emailLocked}
              className={`mt-1 min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-600 dark:bg-zinc-800 ${emailLocked ? "cursor-not-allowed bg-zinc-100 dark:bg-zinc-800/80" : ""}`}
            />
          </label>
          {emailLocked && (
            <p className="text-xs text-zinc-500">האימייל נקבע לפי ההזמנה ולא ניתן לשינוי.</p>
          )}
          <label className="block text-sm font-medium">
            סיסמה (מינ׳ 6 תווים)
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
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
            {pending ? "יוצרת חשבון…" : "הרשמה"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-zinc-600">
          כבר יש לך חשבון?{" "}
          <Link href="/login" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            התחברות
          </Link>
        </p>
      </div>
    </div>
  );
}
