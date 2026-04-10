import { Suspense } from "react";
import { RegisterForm } from "./RegisterForm";

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh min-h-[100svh] items-center justify-center text-zinc-500">טוען…</div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
