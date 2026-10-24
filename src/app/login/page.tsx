import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0d1321] px-4 py-10">
      <div className="w-full max-w-[620px]">
        <Suspense fallback={<p className="text-center text-slate-300">Chargement…</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
