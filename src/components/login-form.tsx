"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

function safeNextPath(value: string | null): string {
  if (!value) return "/account";

  try {
    const target = new URL(value, "https://skillflow.invalid");
    if (target.origin !== "https://skillflow.invalid") return "/account";
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/account";
  }
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setPending(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    try {
      const supabase = getSupabaseClient();
      const result =
        mode === "signup"
          ? await supabase.auth.signUp({ email, password })
          : await supabase.auth.signInWithPassword({ email, password });

      if (result.error) {
        setError(result.error.message);
        return;
      }

      if (mode === "signup" && !result.data.session) {
        setMessage(
          "Compte créé. Consultez votre boîte mail pour confirmer l'adresse, puis connectez-vous."
        );
        return;
      }

      router.push(nextPath);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Connexion impossible.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="w-full rounded-[32px] border border-[#d7dee9] bg-[#f3f4f5] p-7 shadow-[0_20px_45px_rgba(15,23,42,0.14)] sm:p-9">
      <h1 className="text-[clamp(2.5rem,4vw,4rem)] font-bold tracking-[-0.05em] text-slate-900">
        {mode === "signin" ? "Connexion" : "Créer un compte"}
      </h1>

      <p className="mt-4 max-w-[28rem] text-[1.1rem] leading-7 text-slate-600">
        Un compte est nécessaire pour suivre vos commandes et protéger vos achats.
      </p>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-[1.05rem] font-medium text-slate-700"
          >
            E-mail
          </label>
          <input
            id="email"
            name="email"
            autoComplete="email"
            required
            type="email"
            className="w-full rounded-xl border border-transparent bg-[#dfeaf6] px-4 py-3.5 text-[1.5rem] leading-none text-slate-900 outline-none transition focus:border-[#b9c6d4]"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-2 block text-[1.05rem] font-medium text-slate-700"
          >
            Mot de passe
          </label>
          <input
            id="password"
            name="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            minLength={8}
            type="password"
            className="w-full rounded-xl border border-transparent bg-[#dfeaf6] px-4 py-3.5 text-[1.5rem] leading-none text-slate-900 outline-none transition focus:border-[#b9c6d4]"
          />
        </div>

        {error && (
          <p role="alert" className="text-[1.05rem] font-medium text-[#dc2626]">
            {error}
          </p>
        )}

        {message && (
          <p role="status" className="text-[1.05rem] font-medium text-emerald-700">
            {message}
          </p>
        )}

        <button
          disabled={pending}
          type="submit"
          className="mt-1 w-full rounded-full bg-[#0d1321] px-4 py-[0.9rem] text-[1.1rem] font-semibold text-white transition hover:bg-[#111827] disabled:opacity-60"
        >
          {pending ? "Patientez…" : mode === "signin" ? "Se connecter" : "Créer mon compte"}
        </button>
      </form>

      <button
        type="button"
        className="mt-6 block text-[1.05rem] font-medium text-slate-700"
        onClick={() => {
          setError("");
          setMessage("");
          setMode(mode === "signin" ? "signup" : "signin");
        }}
      >
        {mode === "signin" ? "Créer un compte" : "J’ai déjà un compte"}
      </button>
    </section>
  );
}
