"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { CommunitySuggestionForm } from "@/components/community/community-suggestion-form";

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

function ValueIcon({ name }: { name: "people" | "learn" | "progress" }) {
  const paths = {
    people: <><path d="M16 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-4A4.5 4.5 0 0 0 3 18.5V20" /><circle cx="9.5" cy="7" r="4" /><path d="M17 11a4 4 0 1 0 0-8m4 17v-1.5a4.5 4.5 0 0 0-3.5-4.4" /></>,
    learn: <><path d="m2.5 8 9.5-5 9.5 5-9.5 5-9.5-5Z" /><path d="M6 10v6c3.5 3 8.5 3 12 0v-6m3-2v7" /></>,
    progress: <><path d="m3 17 6-6 4 3 8-9" /><path d="M15 5h6v6" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

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
      <section className="relative mb-8 overflow-hidden rounded-2xl border border-[#203650] bg-[#0B1729] shadow-[0_14px_42px_rgba(0,0,0,.18)] sm:mb-10" aria-labelledby="community-hero-title">
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(ellipse_at_70%_50%,rgba(32,221,242,.08),transparent_60%)] sm:block" />
        <div className="relative grid gap-7 p-5 sm:p-7 md:grid-cols-[minmax(0,1fr)_minmax(19rem,.9fr)] md:items-center lg:gap-10 lg:p-9">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#20DDF2]/20 bg-[#20DDF2]/[.05] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-[#70E9F5]"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#20DDF2]" />Communauté Skillsflow</p>
            <h2 id="community-hero-title" className="mt-4 text-[clamp(1.8rem,4vw,3rem)] font-bold leading-[1.08] tracking-[-.04em] text-[#F4F7FC]">Progressez ensemble,<br className="hidden sm:block" /> à votre rythme.</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#A8B7CB] sm:text-base sm:leading-7">Choisissez un salon pour échanger, avancer sur vos objectifs et demander conseil.</p>
          </div>
          <div className="grid grid-cols-2 gap-3" aria-live="polite">
            <article className="min-w-0 rounded-xl border border-[#203650] bg-[#0E1D32] p-4 sm:p-5">
              <div className="flex items-center gap-2 text-[#A8B7CB]"><span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#20DDF2]/[.08] text-[#70E9F5]"><svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5Zm0 0V21m4-14h8m-8 4h8" /></svg></span><span className="text-[10px] font-bold uppercase tracking-[.12em] sm:text-[11px]">Salons ouverts</span></div>
              {loading ? <p className="mt-3 h-9 animate-pulse rounded bg-white/[.06]" aria-label="Chargement du nombre de salons" /> : <p className="mt-3 text-3xl font-bold tracking-tight text-white">{accessibleChannels.length}<span className="ml-1 text-lg font-medium text-[#8094AC]">/{channels.length}</span></p>}
            </article>
            <article className="min-w-0 rounded-xl border border-[#203650] bg-[#0E1D32] p-4 sm:p-5">
              <div className="flex items-center gap-2 text-[#A8B7CB]"><span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#20DDF2]/[.08] text-[#70E9F5]"><svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="8.5"/><path strokeLinecap="round" strokeLinejoin="round" d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2Z"/></svg></span><span className="text-[10px] font-bold uppercase tracking-[.12em] sm:text-[11px]">À découvrir</span></div>
              {loading ? <p className="mt-3 h-9 animate-pulse rounded bg-white/[.06]" aria-label="Chargement des nouveautés" /> : <p className="mt-3 text-3xl font-bold tracking-tight text-white">{unreadCount}</p>}
            </article>
          </div>
        </div>
      </section>

      <section className="mb-8 grid gap-3 sm:grid-cols-2" aria-label="Vos espaces de communauté">
        <Link href="/community/my" className="group flex items-center justify-between gap-4 rounded-2xl border border-[#20DDF2]/25 bg-[linear-gradient(115deg,rgba(32,221,242,.08),rgba(11,23,41,.96)_58%)] p-4 transition duration-200 hover:-translate-y-0.5 hover:border-[#20DDF2]/55 hover:bg-[#0E1D32] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#70E9F5] sm:p-5"><span className="flex min-w-0 items-center gap-3"><span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#20DDF2]/[.08] text-lg text-[#70E9F5]">◈</span><span className="min-w-0"><span className="block font-bold text-white">Ma communauté</span><span className="mt-1 block text-sm text-[#91A4B9]">Créez votre espace, invitez votre équipe et suivez ses objectifs.</span></span></span><span aria-hidden="true" className="text-[#70E9F5] transition-transform group-hover:translate-x-1">→</span></Link>
        <Link href="/community/private-messages" className="group flex items-center justify-between gap-4 rounded-2xl border border-[#203650] bg-[#0B1729] p-4 transition duration-200 hover:-translate-y-0.5 hover:border-[#20DDF2]/45 hover:bg-[#0E1D32] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#70E9F5] sm:p-5">
          <span className="flex min-w-0 items-center gap-3"><span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#20DDF2]/[.08] text-lg text-[#70E9F5]">✉</span><span className="min-w-0"><span className="block font-bold text-white">Messages privés</span><span className="mt-1 block text-sm text-[#91A4B9]">Échangez directement entre membres.</span></span></span><span aria-hidden="true" className="text-[#70E9F5] transition-transform group-hover:translate-x-1">→</span>
        </Link>
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
      <section id="valeurs" className="mb-8 scroll-mt-28 sm:mb-10" aria-labelledby="community-values-title">
        <div className="mb-5 flex flex-col gap-4 border-l-2 border-[#20DDF2] pl-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:pl-5">
          <div className="max-w-3xl">
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#70E9F5]">L’esprit Skillsflow</p>
            <h2 id="community-values-title" className="mt-1.5 text-2xl font-bold leading-tight tracking-[-.035em] text-[#F4F7FC] sm:text-3xl">Une communauté fondée sur le partage</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#A8B7CB]">Des échanges utiles, des formations concrètes et une progression qui respecte le rythme de chacun.</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:shrink-0">
            <Link href="/community/closing-negociation" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#20DDF2] px-4 text-sm font-bold text-[#06131F] transition duration-200 hover:-translate-y-0.5 hover:bg-[#70E9F5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#70E9F5]">Découvrir l’académie <span aria-hidden="true">↗</span></Link>
            <Link href="#suggestion" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#203650] px-4 text-sm font-semibold text-[#C5D3E2] transition hover:border-[#20DDF2]/45 hover:bg-white/[.03] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#70E9F5]">Faire une suggestion</Link>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <article className="group rounded-xl border border-[#203650] bg-[#0E1D32] p-4 transition duration-200 hover:-translate-y-1 hover:border-[#20DDF2]/35 hover:bg-[#10223A] sm:p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#20DDF2]/[.08] text-[#70E9F5]"><ValueIcon name="people" /></span>
            <h3 className="mt-4 text-base font-semibold text-[#F4F7FC]">Partager avec respect</h3>
            <p className="mt-2 text-sm leading-6 text-[#A8B7CB]">Écoutez les expériences de chacun et posez vos questions dans un environnement bienveillant.</p>
          </article>
          <article className="group rounded-xl border border-[#203650] bg-[#0E1D32] p-4 transition duration-200 hover:-translate-y-1 hover:border-[#20DDF2]/35 hover:bg-[#10223A] sm:p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#20DDF2]/[.08] text-[#70E9F5]"><ValueIcon name="learn" /></span>
            <h3 className="mt-4 text-base font-semibold text-[#F4F7FC]">Apprendre par la pratique</h3>
            <p className="mt-2 text-sm leading-6 text-[#A8B7CB]">Profitez de conseils concrets, de retours d’expérience et de formations pour progresser étape par étape.</p>
          </article>
          <article className="group rounded-xl border border-[#203650] bg-[#0E1D32] p-4 transition duration-200 hover:-translate-y-1 hover:border-[#20DDF2]/35 hover:bg-[#10223A] sm:p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#20DDF2]/[.08] text-[#70E9F5]"><ValueIcon name="progress" /></span>
            <h3 className="mt-4 text-base font-semibold text-[#F4F7FC]">Avancer sans pression</h3>
            <p className="mt-2 text-sm leading-6 text-[#A8B7CB]">Progressez à votre rythme, sans promesses irréalistes, sans jugement et sans pression inutile.</p>
          </article>
        </div>
      </section>
      {loading ? <p aria-live="polite" className="rounded-2xl border border-slate-700 bg-[#101a2b] p-6 text-slate-300">Chargement des salons…</p> : !rules && (
        <div className="grid items-start gap-5 lg:grid-cols-[290px_minmax(0,1fr)] lg:gap-7">
          <aside className="h-fit rounded-2xl border border-[#203650] bg-[#0B1729] p-4 sm:p-5" aria-label="Menu des salons">
            <div className="flex items-center justify-between gap-3 px-2 pb-4">
              <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-cyan-300">Explorer</p><h2 className="mt-1 text-lg font-bold text-white">Les salons</h2></div>
              <span className="rounded-full border border-[#203650] bg-[#07111F] px-2.5 py-1 text-xs font-semibold text-[#A8B7CB]">{accessibleChannels.length} ouverts</span>
            </div>
            <nav aria-label="Salons et académie de la communauté" className="grid gap-2">
              {channels.length === 0 && <p className="rounded-xl border border-[#203650] bg-[#07111F] p-4 text-sm leading-6 text-[#A8B7CB]">Aucun salon n’est disponible pour le moment.</p>}
              {sidebarItems.map((item, index) => item.type === "academy" ? (
                <Link key="closing-negociation" href="/community/closing-negociation" style={{ animationDelay: `${index * 65}ms` }} className="group relative flex min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-[#20DDF2]/30 bg-[#20DDF2]/[.05] p-3.5 transition duration-200 hover:border-[#20DDF2]/55 hover:bg-[#20DDF2]/[.09] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 motion-reduce:transform-none">
                  <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#20DDF2]/[.09] text-lg font-bold text-[#70E9F5]">◎</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-white">Closing &amp; Négociation</span><span className="mt-0.5 block truncate text-xs text-slate-300">Apprenez à accompagner une décision éclairée.</span></span>
                  <span aria-hidden="true" className="shrink-0 text-sm text-cyan-200 transition group-hover:translate-x-0.5">→</span>
                </Link>
              ) : item.channel.accessible ? (
                <Link key={item.channel.id} href={`/community/channels/${item.channel.id}`} style={{ animationDelay: `${index * 65}ms` }} className="group relative flex min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-[#203650] bg-[#0E1D32] p-3.5 transition duration-200 hover:border-[#20DDF2]/40 hover:bg-[#10223A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 motion-reduce:transform-none">
                  <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#20DDF2]/[.07] text-lg font-bold text-[#70E9F5] transition duration-200 group-hover:bg-[#20DDF2]/[.13]">{iconBySlug[item.channel.slug] ?? "✦"}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-[#EAF1F8] transition-colors group-hover:text-white">{item.channel.name}</span><span className="mt-0.5 block truncate text-xs text-[#8FA2B8]">{item.channel.description}</span></span>
                  {item.channel.unread_count > 0 ? <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-cyan-300 px-1.5 text-[11px] font-black text-slate-950" aria-label={`${item.channel.unread_count} message(s) non lu(s)`}>{item.channel.unread_count}</span> : <span aria-hidden="true" className="shrink-0 text-sm text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-cyan-200">→</span>}
                  <span aria-hidden="true" className="absolute bottom-3 left-0 top-3 w-0.5 origin-center scale-y-0 rounded-full bg-cyan-300 transition-transform duration-300 group-hover:scale-y-100" />
                </Link>
              ) : (
                <div key={item.channel.id} style={{ animationDelay: `${index * 65}ms` }} className="flex items-center gap-3 rounded-xl border border-[#203650]/70 bg-[#07111F]/80 p-3.5 opacity-75">
                  <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-950/35 text-sm text-slate-500">⌑</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-300">{item.channel.name}</span><span className="mt-0.5 block text-xs text-slate-500">Niveau {item.channel.required_tier} requis</span></span>
                  <span aria-label="Salon verrouillé" className="text-xs text-slate-500">🔒</span>
                </div>
              ))}
            </nav>
            <button type="button" onClick={() => void loadChannels()} disabled={loading} className="mt-4 min-h-11 w-full rounded-xl border border-[#203650] px-3 py-2.5 text-sm font-semibold text-[#A8B7CB] transition hover:border-[#20DDF2]/40 hover:text-[#70E9F5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 disabled:cursor-wait disabled:opacity-60">{loading ? "Actualisation…" : "↻ Actualiser les salons"}</button>
          </aside>

          <section className="relative min-h-[320px] overflow-hidden rounded-2xl border border-[#203650] bg-[#0B1729] p-5 sm:min-h-[360px] sm:p-7">
            <div className="flex min-h-[270px] flex-col justify-between sm:min-h-[310px]">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-[#20DDF2]/20 bg-[#20DDF2]/[.05] px-3 py-1.5 text-xs font-semibold text-[#70E9F5]"><span className="h-1.5 w-1.5 rounded-full bg-[#20DDF2]" />Un espace pour avancer sans pression</span>
                <h2 className="mt-5 max-w-xl text-2xl font-bold leading-tight tracking-[-.03em] text-[#F4F7FC] sm:text-3xl">Les bonnes conversations font avancer les idées.</h2>
                <p className="mt-3 max-w-lg text-sm leading-6 text-[#A8B7CB]">Présentez-vous, partagez vos expériences et trouvez le salon adapté à votre prochaine étape.</p>
              </div>
              <div className="mt-7 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#203650] bg-[#0E1D32] p-4">
                <div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#70E9F5]">Votre prochaine étape</p><p className="mt-1 text-sm leading-6 text-[#A8B7CB]">{organisation ? "Suivez votre objectif hebdomadaire avec la communauté." : "Choisissez un salon et lancez la conversation."}</p></div>
                {organisation ? <Link href={`/community/channels/${organisation.id}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#20DDF2] px-4 py-2 text-sm font-bold text-[#06131F] transition duration-200 hover:-translate-y-0.5 hover:bg-[#70E9F5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#70E9F5]">Voir l’organisation <span aria-hidden="true">↗</span></Link> : <span className="text-sm font-semibold text-[#70E9F5]">{accessibleChannels.length} salon{accessibleChannels.length > 1 ? "s" : ""} à explorer</span>}
              </div>
            </div>
          </section>
        </div>
      )}
      {!rules && <div className="mt-8 sm:mt-10"><CommunitySuggestionForm /></div>}
    </main>
  );
}
