"use client";

import { useState, type FormEvent } from "react";

export function CommunitySuggestionForm() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setNotice(null);
    try {
      const response = await fetch("/api/community/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Impossible d’envoyer votre suggestion.");
      setSubject("");
      setMessage("");
      setNotice({ type: "success", text: "Merci, votre suggestion a bien été transmise à l’équipe SkillFlow." });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Une erreur est survenue." });
    } finally {
      setPending(false);
    }
  }

  return (
    <section id="suggestion" className="mb-6 scroll-mt-28 rounded-3xl border border-cyan-300/20 bg-[radial-gradient(ellipse_at_top_right,rgba(34,211,238,.09),transparent_45%),#101a2b] p-5 shadow-[0_18px_55px_rgba(0,0,0,.16)] sm:mb-8 sm:p-6" aria-labelledby="community-suggestion-title">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] lg:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Votre voix compte</p>
          <h2 id="community-suggestion-title" className="mt-2 text-xl font-bold text-white sm:text-2xl">Une idée pour SkillFlow ?</h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-slate-300">Partagez une amélioration, un besoin ou un sujet à développer. Votre message est transmis en privé à l’équipe.</p>
          <p className="mt-3 text-xs text-slate-400">Seule l’équipe SkillFlow pourra lire votre suggestion.</p>
        </div>
        <form className="grid gap-3" onSubmit={(event) => void submit(event)}>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-200" htmlFor="community-suggestion-subject">
            Sujet
            <input id="community-suggestion-subject" required minLength={3} maxLength={160} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Ex. Un thème pour une prochaine formation" className="min-h-11 rounded-xl border border-slate-600 bg-[#0b1220] px-3.5 py-2.5 text-base text-white outline-none placeholder:text-slate-500 focus-visible:border-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-300/30" />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-200" htmlFor="community-suggestion-message">
            Votre suggestion
            <textarea id="community-suggestion-message" required minLength={10} maxLength={5000} rows={4} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Expliquez-nous ce qui vous aiderait…" className="resize-y rounded-xl border border-slate-600 bg-[#0b1220] px-3.5 py-2.5 text-base leading-6 text-white outline-none placeholder:text-slate-500 focus-visible:border-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-300/30" />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {notice ? <p role={notice.type === "error" ? "alert" : "status"} className={`text-sm ${notice.type === "error" ? "text-rose-200" : "text-emerald-200"}`}>{notice.text}</p> : <span />}
            <button type="submit" disabled={pending} className="min-h-11 rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-bold text-slate-950 transition duration-300 hover:-translate-y-0.5 hover:bg-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 disabled:cursor-wait disabled:opacity-60">{pending ? "Envoi…" : "Envoyer ma suggestion"}</button>
          </div>
        </form>
      </div>
    </section>
  );
}
