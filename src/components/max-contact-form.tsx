"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

export function MaxContactForm() {
  const [form, setForm] = useState({ goals: "", sources: "", workflows: "", availability: "", consent: false });
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setError("");
    try {
      const { data } = await getSupabaseClient().auth.getSession();
      if (!data.session) throw new Error("Connectez-vous pour envoyer votre demande Max.");
      const response = await fetch("/api/account/support-tickets", {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "other",
          subject: "Demande Skillsflow Max / Jarvis",
          message: [
            `Objectifs : ${form.goals}`,
            `Sources à connecter : ${form.sources}`,
            `Automatisations souhaitées : ${form.workflows}`,
            `Disponibilités : ${form.availability}`,
            "Accord collecte et personnalisation : oui",
          ].join("\n"),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Impossible d’envoyer votre demande.");
      setMessage("Votre demande est envoyée. L’équipe vous recontactera avant toute proposition de paiement.");
      setForm({ goals: "", sources: "", workflows: "", availability: "", consent: false });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible d’envoyer votre demande.");
    } finally {
      setPending(false);
    }
  }

  const field = "mt-2 w-full rounded-xl border border-[#27375B] bg-[#0D1527] px-4 py-3 text-sm text-white outline-none placeholder:text-[#71809B] focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20";

  return (
    <main className="min-h-screen bg-[#0B1020] px-4 py-10 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/#tarifs" className="inline-flex min-h-11 items-center rounded-xl border border-cyan-300/30 px-4 py-2 text-sm font-semibold text-cyan-100">Retour aux tarifs</Link>
        <section className="mt-6 rounded-3xl border border-cyan-300/25 bg-[#11182B] p-6 shadow-2xl sm:p-9">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Skillsflow Max · Jarvis</p>
          <h1 className="mt-3 text-3xl font-black text-white sm:text-4xl">Préparons votre assistant IA personnel.</h1>
          <p className="mt-3 text-sm leading-6 text-[#C5D3E2]">Décrivez votre quotidien et vos objectifs. Nous validerons ensemble les sources, les autorisations et le périmètre avant toute étape de paiement.</p>
          {(error || message) && <p role={error ? "alert" : "status"} className={`mt-5 rounded-xl border p-4 text-sm ${error ? "border-rose-300/30 bg-rose-300/10 text-rose-100" : "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"}`}>{error || message}</p>}
          <form onSubmit={(event) => void submit(event)} className="mt-7 space-y-5">
            <label className="block text-sm font-semibold text-white">Vos objectifs avec Jarvis<textarea required minLength={10} maxLength={2000} value={form.goals} onChange={(event) => setForm({ ...form, goals: event.target.value })} placeholder="Ex. organiser mes suivis, préparer mes priorités..." className={field} rows={4} /></label>
            <label className="block text-sm font-semibold text-white">Sources que vous envisagez de connecter<textarea required minLength={10} maxLength={2000} value={form.sources} onChange={(event) => setForm({ ...form, sources: event.target.value })} placeholder="Google, WhatsApp, e-mails, documents..." className={field} rows={3} /></label>
            <label className="block text-sm font-semibold text-white">Automatisations souhaitées<textarea required minLength={10} maxLength={2000} value={form.workflows} onChange={(event) => setForm({ ...form, workflows: event.target.value })} placeholder="Quelles tâches souhaitez-vous déléguer ?" className={field} rows={3} /></label>
            <label className="block text-sm font-semibold text-white">Vos disponibilités<textarea required minLength={5} maxLength={500} value={form.availability} onChange={(event) => setForm({ ...form, availability: event.target.value })} placeholder="Jours et horaires préférés..." className={field} rows={2} /></label>
            <label className="flex items-start gap-3 rounded-xl border border-[#27375B] bg-[#0D1527] p-4 text-sm text-[#C5D3E2]"><input type="checkbox" required checked={form.consent} onChange={(event) => setForm({ ...form, consent: event.target.checked })} className="mt-1 h-4 w-4 accent-cyan-300" />J’accepte que l’équipe Skillflow utilise ces informations pour étudier et personnaliser mon projet Jarvis avant toute proposition commerciale.</label>
            <button type="submit" disabled={pending} className="min-h-12 rounded-xl bg-cyan-300 px-6 py-3 text-sm font-bold text-slate-950 disabled:cursor-wait disabled:opacity-60">{pending ? "Envoi…" : "Envoyer ma demande"}</button>
          </form>
        </section>
      </div>
    </main>
  );
}

