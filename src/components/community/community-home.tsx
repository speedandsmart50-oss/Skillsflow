"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";

type Channel = {
  id: string;
  slug: string;
  name: string;
  description: string;
  required_tier: number;
  accessible: boolean;
  unread_count: number;
};
type Rules = { version: string; body: string };
type Payload = { channels?: Channel[]; rules?: Rules | null; error?: string };

const cardClass = "rounded-2xl border border-slate-700/80 bg-[#111c2e] p-5 transition hover:border-cyan-300/50 hover:bg-[#142238]";

export function CommunityHome({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [rules, setRules] = useState<Rules | null>(null);
  const [displayName, setDisplayName] = useState(initialName.slice(0, 60));
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const loadChannels = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/community/channels", { cache: "no-store" });
      const payload = await response.json() as Payload;
      if (response.status === 428) {
        setRules(payload.rules ?? null);
        setChannels([]);
      } else if (!response.ok) {
        setError(payload.error ?? "Impossible de charger la communauté.");
      } else {
        setRules(null);
        setChannels(payload.channels ?? []);
      }
    } catch {
      setError("La communauté est momentanément inaccessible. Vérifiez votre connexion puis réessayez.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadChannels(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadChannels]);

  async function acceptRules(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rules || !accepted || !displayName.trim()) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/community/rules/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: rules.version, displayName }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Impossible d’enregistrer votre acceptation.");
      await loadChannels();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main>
      <section className="mb-7 rounded-3xl border border-cyan-300/15 bg-gradient-to-br from-[#10283a] via-[#101a2b] to-[#15162f] p-6 sm:p-8">
        <p className="text-sm font-semibold text-cyan-200">Un espace pour avancer sans pression</p>
        <h2 className="mt-2 max-w-3xl text-2xl font-bold leading-tight text-white sm:text-3xl">Des échanges utiles, des objectifs réalistes et une communauté qui respecte votre rythme.</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Choisissez un salon pour poser vos questions, partager vos idées et construire une routine plus régulière.</p>
      </section>

      {rules && (
        <section className="mb-7 rounded-2xl border border-amber-300/30 bg-amber-300/[.06] p-5 sm:p-7" aria-labelledby="community-rules-title">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-amber-200">Avant de participer</p>
          <h2 id="community-rules-title" className="mt-2 text-xl font-bold text-white">Les règles de la communauté</h2>
          <p className="mt-3 leading-7 text-slate-200">{rules.body}</p>
          <form className="mt-5 grid gap-4 sm:max-w-xl" onSubmit={(event) => void acceptRules(event)}>
            <label className="grid gap-2 text-sm font-medium text-slate-200" htmlFor="community-display-name">
              Nom affiché aux autres membres
              <input id="community-display-name" maxLength={60} minLength={1} required value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="rounded-xl border border-slate-600 bg-[#0b1220] px-4 py-3 text-white outline-none focus-visible:border-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-300/30" />
            </label>
            <label className="flex items-start gap-3 text-sm leading-6 text-slate-200">
              <input type="checkbox" required checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1 h-4 w-4 accent-cyan-300" />
              <span>J’ai lu et j’accepte les règles de la communauté.</span>
            </label>
            <button disabled={pending || !accepted} className="rounded-full bg-cyan-300 px-5 py-3 font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50">
              {pending ? "Enregistrement…" : "Accepter et continuer"}
            </button>
          </form>
        </section>
      )}

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Vos espaces d’échange</p>
          <h2 className="mt-1 text-2xl font-bold text-white">Salons</h2>
        </div>
        {!loading && !rules && <span className="text-sm text-slate-400">{channels.filter((channel) => channel.accessible).length} accessible(s)</span>}
      </div>

      {error && <p role="alert" className="mb-4 rounded-xl border border-rose-300/30 bg-rose-300/10 p-4 text-sm text-rose-100">{error}</p>}
      {loading ? (
        <p aria-live="polite" className="rounded-2xl border border-slate-700 bg-[#101a2b] p-6 text-slate-300">Chargement des salons…</p>
      ) : !rules && channels.length === 0 && !error ? (
        <p className="rounded-2xl border border-slate-700 bg-[#101a2b] p-6 text-slate-300">Aucun salon n’est disponible pour le moment.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {channels.map((channel) => (
            <li key={channel.id}>
              {channel.accessible ? (
                <Link href={`/community/channels/${channel.id}`} className={`${cardClass} block h-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300`}>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-bold text-white">{channel.name}</h3>
                    {channel.unread_count > 0 && <span className="min-w-7 rounded-full bg-cyan-300 px-2 py-1 text-center text-xs font-bold text-slate-950" aria-label={`${channel.unread_count} message(s) non lu(s)`}>{channel.unread_count}</span>}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{channel.description}</p>
                  <span className="mt-5 inline-flex text-sm font-semibold text-cyan-200">Ouvrir le salon →</span>
                </Link>
              ) : (
                <div className="h-full rounded-2xl border border-slate-800 bg-[#0c1422] p-5 opacity-80">
                  <div className="flex items-center justify-between gap-3"><h3 className="font-bold text-slate-200">{channel.name}</h3><span aria-label="Salon verrouillé">🔒</span></div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{channel.description}</p>
                  <p className="mt-4 text-xs font-semibold text-amber-200">Réservé au niveau {channel.required_tier}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {!rules && <button type="button" onClick={() => void loadChannels()} className="mt-5 rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">Actualiser les salons</button>}
    </main>
  );
}
