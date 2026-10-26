"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

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
type SidebarItem = { type: "academy" } | { type: "channel"; channel: Channel };

const iconBySlug: Record<string, string> = {
  bienvenue: "✦",
  prospection: "↗",
  "confiance-et-rejet": "◇",
  "questions-au-coach": "?",
};

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

  const accessibleChannels = useMemo(() => channels.filter((channel) => channel.accessible), [channels]);
  const sidebarItems = useMemo<SidebarItem[]>(() => {
    const organisationIndex = channels.findIndex((channel) => channel.slug === "organisation");
    const coachIndex = channels.findIndex((channel) => channel.slug === "questions-au-coach");
    const channelItems: SidebarItem[] = channels
      .filter((channel) => channel.slug !== "organisation")
      .map((channel) => ({ type: "channel", channel }));
    const beforeChannelIndex = coachIndex >= 0
      ? channels.slice(0, coachIndex).filter((channel) => channel.slug !== "organisation").length
      : organisationIndex >= 0
        ? channels.slice(0, organisationIndex).filter((channel) => channel.slug !== "organisation").length
        : channelItems.length;
    channelItems.splice(beforeChannelIndex, 0, { type: "academy" });
    return channelItems;
  }, [channels]);
  const unreadCount = accessibleChannels.reduce((total, channel) => total + channel.unread_count, 0);
  const organisation = accessibleChannels.find((channel) => channel.slug === "organisation");

  return (
    <main>
      <section className="animate-rise relative mb-6 overflow-hidden rounded-3xl border border-cyan-300/20 bg-[radial-gradient(ellipse_at_top_right,rgba(34,211,238,.15),transparent_42%),linear-gradient(120deg,#10283a,#101a2b_60%,#15162f)] p-6 shadow-[0_20px_65px_rgba(0,0,0,.2)] sm:mb-8 sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full border border-cyan-300/10 bg-cyan-300/[.025] blur-2xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[.23em] text-cyan-300">Communauté SkillFlow</p>
            <h2 className="mt-2 text-2xl font-bold leading-tight text-white sm:text-3xl">Progressez ensemble, à votre rythme.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Choisissez un salon pour échanger, avancer sur vos objectifs et demander conseil.</p>
          </div>
          {!loading && !rules && <div className="flex gap-2">
            <div className="rounded-xl border border-white/10 bg-slate-950/35 px-3.5 py-2.5"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Salons ouverts</p><p className="mt-1 text-lg font-bold text-white">{accessibleChannels.length}<span className="ml-1 text-xs font-medium text-slate-400">/ {channels.length}</span></p></div>
            <div className="rounded-xl border border-white/10 bg-slate-950/35 px-3.5 py-2.5"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">À découvrir</p><p className="mt-1 text-lg font-bold text-cyan-200">{unreadCount}</p></div>
          </div>}
        </div>
      </section>

      {rules && (
        <section className="animate-rise mb-7 rounded-2xl border border-amber-300/30 bg-amber-300/[.06] p-5 sm:p-7" aria-labelledby="community-rules-title">
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

      {error && <p role="alert" className="animate-rise mb-5 rounded-xl border border-rose-300/30 bg-rose-300/10 p-4 text-sm text-rose-100">{error}</p>}
      <section id="valeurs" className="mb-6 scroll-mt-28 rounded-3xl border border-cyan-300/15 bg-[#101a2b] p-5 shadow-[0_18px_55px_rgba(0,0,0,.16)] sm:mb-8 sm:p-6" aria-labelledby="community-values-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Apprendre et avancer ensemble</p><h2 id="community-values-title" className="mt-2 text-xl font-bold text-white sm:text-2xl">Une communauté fondée sur le partage</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Des échanges utiles, des formations concrètes et une progression qui respecte le rythme de chacun.</p></div>
          <Link href="/community/closing-negociation" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-cyan-300/25 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300/55 hover:bg-cyan-300/[.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">Découvrir l’académie <span aria-hidden="true">↗</span></Link>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl border border-white/[.07] bg-slate-950/25 p-4"><h3 className="font-semibold text-white">Partager avec respect</h3><p className="mt-1.5 text-sm leading-6 text-slate-300">Écouter les expériences et accueillir les questions sans jugement.</p></article>
          <article className="rounded-2xl border border-white/[.07] bg-slate-950/25 p-4"><h3 className="font-semibold text-white">Apprendre par la pratique</h3><p className="mt-1.5 text-sm leading-6 text-slate-300">S’appuyer sur les parcours et les échanges pour progresser étape par étape.</p></article>
          <article className="rounded-2xl border border-white/[.07] bg-slate-950/25 p-4"><h3 className="font-semibold text-white">Avancer sans pression</h3><p className="mt-1.5 text-sm leading-6 text-slate-300">Pas de promesse de revenus, de pression ni de messages répétés.</p></article>
        </div>
      </section>
      {loading ? <p aria-live="polite" className="rounded-2xl border border-slate-700 bg-[#101a2b] p-6 text-slate-300">Chargement des salons…</p> : !rules && (
        <div className="grid items-start gap-5 lg:grid-cols-[290px_minmax(0,1fr)] lg:gap-7">
          <aside className="animate-rise h-fit rounded-3xl border border-slate-700/80 bg-gradient-to-b from-[#111c2e] to-[#0c1422] p-4 shadow-[0_18px_55px_rgba(0,0,0,.2)] sm:p-5" aria-label="Menu des salons">
            <div className="flex items-center justify-between gap-3 px-2 pb-4">
              <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-cyan-300">Explorer</p><h2 className="mt-1 text-lg font-bold text-white">Les salons</h2></div>
              <span className="rounded-full border border-slate-700 bg-slate-950/40 px-2.5 py-1 text-xs font-semibold text-slate-300">{accessibleChannels.length} ouverts</span>
            </div>
            <nav aria-label="Salons et académie de la communauté" className="grid gap-2">
              {channels.length === 0 && <p className="rounded-xl border border-slate-700 bg-slate-950/30 p-4 text-sm text-slate-300">Aucun salon n’est disponible pour le moment.</p>}
              {sidebarItems.map((item, index) => item.type === "academy" ? (
                <Link key="closing-negociation" href="/community/closing-negociation" style={{ animationDelay: `${index * 65}ms` }} className="group animate-rise relative flex min-w-0 items-center gap-3 overflow-hidden rounded-2xl border border-cyan-300/35 bg-cyan-300/[.08] p-3.5 transition duration-300 hover:translate-x-1 hover:border-cyan-300/60 hover:bg-cyan-300/[.12] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 motion-reduce:transform-none">
                  <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-lg font-bold text-cyan-200">◎</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-white">Closing &amp; Négociation</span><span className="mt-0.5 block truncate text-xs text-slate-300">Apprenez à accompagner une décision éclairée.</span></span>
                  <span aria-hidden="true" className="shrink-0 text-sm text-cyan-200 transition group-hover:translate-x-0.5">→</span>
                </Link>
              ) : item.channel.accessible ? (
                <Link key={item.channel.id} href={`/community/channels/${item.channel.id}`} style={{ animationDelay: `${index * 65}ms` }} className="group animate-rise relative flex min-w-0 items-center gap-3 overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950/25 p-3.5 transition duration-300 hover:translate-x-1 hover:border-cyan-300/45 hover:bg-cyan-300/[.055] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 motion-reduce:transform-none">
                  <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/[.07] text-lg font-bold text-cyan-200 transition duration-300 group-hover:scale-105 group-hover:border-cyan-300/40 group-hover:bg-cyan-300/15">{iconBySlug[item.channel.slug] ?? "✦"}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-100 transition-colors group-hover:text-white">{item.channel.name}</span><span className="mt-0.5 block truncate text-xs text-slate-400">{item.channel.description}</span></span>
                  {item.channel.unread_count > 0 ? <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-cyan-300 px-1.5 text-[11px] font-black text-slate-950" aria-label={`${item.channel.unread_count} message(s) non lu(s)`}>{item.channel.unread_count}</span> : <span aria-hidden="true" className="shrink-0 text-sm text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-cyan-200">→</span>}
                  <span aria-hidden="true" className="absolute bottom-3 left-0 top-3 w-0.5 origin-center scale-y-0 rounded-full bg-cyan-300 transition-transform duration-300 group-hover:scale-y-100" />
                </Link>
              ) : (
                <div key={item.channel.id} style={{ animationDelay: `${index * 65}ms` }} className="animate-rise flex items-center gap-3 rounded-2xl border border-slate-800/80 bg-[#0c1422]/75 p-3.5 opacity-75">
                  <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-950/35 text-sm text-slate-500">⌑</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-300">{item.channel.name}</span><span className="mt-0.5 block text-xs text-slate-500">Niveau {item.channel.required_tier} requis</span></span>
                  <span aria-label="Salon verrouillé" className="text-xs text-slate-500">🔒</span>
                </div>
              ))}
            </nav>
            <button type="button" onClick={() => void loadChannels()} className="mt-4 w-full rounded-xl border border-slate-700 px-3 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-cyan-300/40 hover:text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">↻ Actualiser les salons</button>
          </aside>

          <section className="animate-rise relative min-h-[360px] overflow-hidden rounded-3xl border border-cyan-300/15 bg-[radial-gradient(ellipse_at_80%_10%,rgba(34,211,238,.12),transparent_35%),linear-gradient(145deg,#111c2e,#0c1422_70%)] p-6 shadow-[0_20px_65px_rgba(0,0,0,.2)] sm:min-h-[440px] sm:p-8" style={{ animationDelay: "100ms" }}>
            <div aria-hidden="true" className="pointer-events-none absolute -right-20 top-24 h-64 w-64 animate-float rounded-full border border-cyan-300/[.08] bg-cyan-300/[.025]" />
            <div aria-hidden="true" className="pointer-events-none absolute -right-10 top-36 h-44 w-44 rounded-full border border-blue-400/[.08]" />
            <div className="relative flex min-h-[310px] flex-col justify-between sm:min-h-[380px]">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[.07] px-3 py-1.5 text-xs font-semibold text-emerald-200"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />Un espace pour avancer sans pression</span>
                <h2 className="mt-6 max-w-xl text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl">Les bonnes conversations font avancer les idées.</h2>
                <p className="mt-4 max-w-lg text-sm leading-7 text-slate-300">Présentez-vous, partagez vos expériences et trouvez le salon adapté à votre prochaine étape.</p>
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[.07] bg-slate-950/30 p-4 sm:p-5">
                <div><p className="text-xs font-bold uppercase tracking-[.16em] text-cyan-200">Votre prochaine étape</p><p className="mt-1 text-sm text-slate-300">{organisation ? "Suivez votre objectif hebdomadaire avec la communauté." : "Choisissez un salon et lancez la conversation."}</p></div>
                {organisation ? <Link href={`/community/channels/${organisation.id}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 transition duration-300 hover:-translate-y-0.5 hover:bg-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200">Voir l’organisation <span aria-hidden="true">↗</span></Link> : <span className="text-sm font-semibold text-cyan-200">{accessibleChannels.length} salon{accessibleChannels.length > 1 ? "s" : ""} à explorer</span>}
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
