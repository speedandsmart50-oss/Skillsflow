"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setPending(true);
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    try {
      const { error: updateError } = await getSupabaseClient().auth.updateUser({ password });
      if (updateError) throw updateError;
      setMessage("Mot de passe mis à jour. Vous allez être redirigé vers votre compte.");
      window.setTimeout(() => { router.replace("/account"); router.refresh(); }, 1200);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de modifier le mot de passe.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-page flex min-h-[100svh] items-center justify-center px-4 py-10">
      <section className="auth-form-card w-full max-w-lg rounded-[1.75rem] border border-cyan-300/20 bg-[#0d1729]/90 p-6 shadow-2xl sm:p-9">
        <h1 className="text-3xl font-semibold text-white">Nouveau mot de passe</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">Choisissez un nouveau mot de passe pour retrouver l’accès à votre compte.</p>
        <form className="mt-7 space-y-5" onSubmit={submit}>
          <label className="block text-sm font-medium text-slate-200" htmlFor="password">Nouveau mot de passe</label>
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required placeholder="Au moins 8 caractères" className="auth-input min-h-[3.35rem] w-full rounded-2xl border border-[#28425f] bg-[#0a1423]/80 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/80" />
          {error && <p role="alert" className="text-sm text-rose-200">{error}</p>}
          {message && <p role="status" className="text-sm text-emerald-100">{message}</p>}
          <button disabled={pending} className="min-h-[3.35rem] w-full rounded-full bg-cyan-300 px-5 py-3 text-sm font-bold text-[#07111e] disabled:opacity-60">{pending ? "Patientez…" : "Enregistrer le mot de passe"}</button>
        </form>
        <Link href="/login" className="mt-6 inline-block text-sm text-cyan-200 underline">Retour à la connexion</Link>
      </section>
    </main>
  );
}
