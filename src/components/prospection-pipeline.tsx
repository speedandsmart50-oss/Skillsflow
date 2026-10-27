"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

type PipelineStage = "new" | "contacted" | "presentation" | "follow-up" | "won" | "lost";

type Prospect = {
  id: string;
  name: string;
  company: string;
  channel: string;
  channelUrl?: string;
  note: string;
  stage: PipelineStage;
  createdAt: string;
};

const STORAGE_KEY = "skillsflow-prospection-pipeline";

const stages: { id: PipelineStage; label: string; description: string; tone: string }[] = [
  { id: "new", label: "Nouveaux leads", description: "À qualifier", tone: "blue" },
  { id: "contacted", label: "Premier contact", description: "Conversation ouverte", tone: "violet" },
  { id: "presentation", label: "Présentation", description: "Offre partagée", tone: "amber" },
  { id: "follow-up", label: "À relancer", description: "Prochaine action", tone: "cyan" },
  { id: "won", label: "Convertis", description: "Relation active", tone: "emerald" },
  { id: "lost", label: "Archivés", description: "À revoir plus tard", tone: "violet" },
];

const channels = ["WhatsApp", "Instagram", "Facebook", "LinkedIn", "TikTok", "Google Maps", "Email", "Téléphone", "Rencontre"];

const fieldClass = "mt-1.5 w-full rounded-xl border border-[#27375B] bg-[#0D1527] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-[#71809B] focus:border-[#55DDF0] focus:ring-2 focus:ring-[#55DDF0]/15";

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function safeChannelUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function stageTone(tone: string) {
  return {
    blue: "border-[#397BFF]/25 bg-[#397BFF]/[.07] text-[#9AB9FF]",
    violet: "border-[#9D8AFF]/25 bg-[#9D8AFF]/[.07] text-[#C8BCFF]",
    amber: "border-amber-300/25 bg-amber-300/[.07] text-amber-200",
    cyan: "border-[#20DDF2]/25 bg-[#20DDF2]/[.07] text-[#8BEAF4]",
    emerald: "border-emerald-300/25 bg-emerald-300/[.07] text-emerald-200",
  }[tone] ?? "border-white/10 bg-white/[.04] text-slate-300";
}

export function ProspectionPipeline() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const loadedRef = useRef(false);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<PipelineStage | "all">("all");
  const [form, setForm] = useState({ name: "", company: "", channel: "WhatsApp", channelUrl: "", note: "" });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed: unknown = JSON.parse(stored);
          if (Array.isArray(parsed)) setProspects(parsed as Prospect[]);
        }
      } catch {
        // The pipeline remains usable if local storage is unavailable or corrupted.
      } finally {
        loadedRef.current = true;
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (loadedRef.current) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prospects));
  }, [prospects]);

  const visibleProspects = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return prospects.filter((prospect) => {
      const matchesQuery = !normalized || `${prospect.name} ${prospect.company} ${prospect.channel}`.toLowerCase().includes(normalized);
      const matchesStage = stageFilter === "all" || prospect.stage === stageFilter;
      return matchesQuery && matchesStage;
    });
  }, [prospects, query, stageFilter]);

  const activeCount = prospects.filter((prospect) => prospect.stage !== "won" && prospect.stage !== "lost").length;
  const wonCount = prospects.filter((prospect) => prospect.stage === "won").length;
  const followUpCount = prospects.filter((prospect) => prospect.stage === "follow-up").length;

  function addProspect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) return;
    setProspects((current) => [{ id: createId(), name: form.name.trim(), company: form.company.trim(), channel: form.channel, channelUrl: safeChannelUrl(form.channelUrl.trim()), note: form.note.trim(), stage: "new", createdAt: new Date().toISOString() }, ...current]);
    setForm({ name: "", company: "", channel: "WhatsApp", channelUrl: "", note: "" });
    setShowForm(false);
  }

  function updateStage(id: string, stage: PipelineStage) {
    setProspects((current) => current.map((prospect) => prospect.id === id ? { ...prospect, stage } : prospect));
  }

  function removeProspect(id: string) {
    setProspects((current) => current.filter((prospect) => prospect.id !== id));
  }

  return (
    <section className="mt-8" aria-labelledby="pipeline-heading">
      <div className="flex flex-col gap-4 rounded-3xl border border-[#202E50] bg-[#11182B] p-5 shadow-[0_24px_80px_rgba(0,0,0,.22)] sm:p-7">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#20DDF2]"><span className="h-2 w-2 rounded-full bg-[#20DDF2] shadow-[0_0_12px_#20DDF2]" /> Pipeline local</div>
            <h2 id="pipeline-heading" className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">Suivez chaque conversation au même endroit.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8F9CAE]">Ajoutez vos contacts, déplacez-les dans les étapes du pipeline et gardez une prochaine action claire.</p>
          </div>
          <button type="button" onClick={() => setShowForm((open) => !open)} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#397BFF] to-[#6557FF] px-5 py-3 text-sm font-bold text-white shadow-[0_8px_24px_rgba(57,123,255,.25)] transition hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#70E9F5]">
            <span className="text-lg leading-none">+</span>{showForm ? "Fermer" : "Ajouter un contact"}
          </button>
        </div>

        {showForm && <form onSubmit={addProspect} className="grid gap-4 rounded-2xl border border-[#27375B] bg-[#0D1527] p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-[1fr_1fr_0.8fr_1.4fr_1.4fr_auto] lg:items-end">
          <label className="text-xs font-semibold text-[#A8B7CB]">Nom du contact<input required maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex. Marie Dupont" className={fieldClass} /></label>
          <label className="text-xs font-semibold text-[#A8B7CB]">Entreprise ou activité<input maxLength={100} value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} placeholder="Ex. Atelier Studio" className={fieldClass} /></label>
          <label className="text-xs font-semibold text-[#A8B7CB]">Canal<select value={form.channel} onChange={(event) => setForm({ ...form, channel: event.target.value })} className={fieldClass}>{channels.map((channel) => <option key={channel}>{channel}</option>)}</select></label>
          <label className="text-xs font-semibold text-[#A8B7CB]">Lien de redirection<input type="url" maxLength={500} value={form.channelUrl} onChange={(event) => setForm({ ...form, channelUrl: event.target.value })} placeholder="https://..." className={fieldClass} /></label>
          <label className="text-xs font-semibold text-[#A8B7CB]">Note ou prochaine action<input maxLength={180} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Ex. Envoyer la présentation vendredi" className={fieldClass} /></label>
          <button type="submit" className="min-h-12 rounded-xl bg-[#20DDF2] px-5 text-sm font-bold text-[#06131F] transition hover:bg-[#70E9F5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#70E9F5]">Créer</button>
        </form>}

        <div className="grid gap-3 border-y border-[#202E50] py-4 sm:grid-cols-3">
          {[{ label: "Contacts actifs", value: activeCount, detail: "dans le pipeline" }, { label: "À relancer", value: followUpCount, detail: "prochaine action" }, { label: "Convertis", value: wonCount, detail: "relation active" }].map((stat) => <div key={stat.label} className="flex items-center gap-3 rounded-xl bg-[#0D1527]/70 px-4 py-3"><span className="text-2xl font-black text-white">{stat.value}</span><span><span className="block text-xs font-semibold text-[#C5D3E2]">{stat.label}</span><span className="block text-[11px] text-[#71809B]">{stat.detail}</span></span></div>)}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-white">Votre pipeline</p>
          <label className="relative block sm:w-72"><span className="sr-only">Rechercher un contact</span><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#71809B]">⌕</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un contact" className="min-h-10 w-full rounded-xl border border-[#27375B] bg-[#0D1527] pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-[#71809B] focus:border-[#55DDF0] focus:ring-2 focus:ring-[#55DDF0]/15" /></label>
        </div>

        <div className="flex justify-end">
          <label className="sr-only" htmlFor="prospection-stage-filter">Filtrer par étape</label>
          <select id="prospection-stage-filter" value={stageFilter} onChange={(event) => setStageFilter(event.target.value as PipelineStage | "all")} className="min-h-10 rounded-xl border border-[#27375B] bg-[#0D1527] px-3 text-sm text-[#C5D3E2] outline-none focus:border-[#55DDF0]">
            <option value="all">Toutes les étapes</option>
            {stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
          </select>
        </div>

        <div className="flex min-w-0 gap-4 overflow-x-auto pb-3 [scrollbar-color:#397BFF_#0D1527]">
          {stages.map((stage) => {
            const items = visibleProspects.filter((prospect) => prospect.stage === stage.id);
            return <div key={stage.id} className="w-[270px] shrink-0 rounded-2xl border border-[#202E50] bg-[#0D1527]/65 p-3 sm:w-[290px]">
              <div className="flex items-start justify-between gap-3 px-1 pb-3"><div><h3 className="text-sm font-bold text-white">{stage.label}</h3><p className="mt-0.5 text-[11px] text-[#71809B]">{stage.description}</p></div><span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${stageTone(stage.tone)}`}>{items.length}</span></div>
              <div className="space-y-2">
                {items.map((prospect) => <article key={prospect.id} className="rounded-xl border border-[#27375B] bg-[#151F38] p-3 transition hover:border-[#397BFF]/50">
                  <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h4 className="truncate text-sm font-bold text-white">{prospect.name}</h4>{prospect.company && <p className="mt-0.5 truncate text-xs text-[#8F9CAE]">{prospect.company}</p>}</div><button type="button" onClick={() => removeProspect(prospect.id)} aria-label={`Supprimer ${prospect.name}`} className="shrink-0 rounded p-1 text-[#71809B] transition hover:bg-rose-400/10 hover:text-rose-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-300">×</button></div>
                  <div className="mt-3 grid gap-2"><span className="w-fit rounded-md bg-white/[.05] px-2 py-1 text-[10px] font-semibold text-[#A8B7CB]">{prospect.channel}</span><select aria-label={`Étape de ${prospect.name}`} value={prospect.stage} onChange={(event) => updateStage(prospect.id, event.target.value as PipelineStage)} className="w-full min-w-0 rounded-md border border-[#27375B] bg-[#0D1527] px-2 py-2 text-[11px] text-[#C5D3E2] outline-none focus:border-[#55DDF0]"><option value="new">Nouveaux leads</option><option value="contacted">Premier contact</option><option value="presentation">Présentation</option><option value="follow-up">À relancer</option><option value="won">Converti</option><option value="lost">Perdu</option></select></div>
                  {prospect.channelUrl && safeChannelUrl(prospect.channelUrl) && <a href={safeChannelUrl(prospect.channelUrl)} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-9 items-center justify-center rounded-lg border border-[#20DDF2]/30 bg-[#20DDF2]/[.06] px-3 text-xs font-bold text-[#8BEAF4] transition hover:border-[#20DDF2]/70 hover:bg-[#20DDF2]/[.12]">Ouvrir {prospect.channel}</a>}
                  {prospect.note && <p className="mt-2 border-t border-[#27375B] pt-2 text-[11px] leading-4 text-[#8F9CAE]">{prospect.note}</p>}
                </article>)}
                {!items.length && <div className="rounded-xl border border-dashed border-[#27375B] px-3 py-7 text-center text-xs text-[#71809B]">Aucun contact ici</div>}
              </div>
            </div>;
          })}
        </div>
        {!prospects.length && <div className="rounded-2xl border border-dashed border-[#397BFF]/40 bg-[#397BFF]/[.04] p-8 text-center"><p className="text-sm font-semibold text-white">Votre pipeline est prêt.</p><p className="mt-1 text-sm text-[#8F9CAE]">Ajoutez votre premier contact pour commencer à suivre vos conversations.</p><button type="button" onClick={() => setShowForm(true)} className="mt-4 text-sm font-bold text-[#70E9F5] underline underline-offset-4 hover:text-white">Ajouter un premier contact</button></div>}
      </div>
      <p className="mt-3 text-xs leading-5 text-[#71809B]">Vos contacts sont conservés dans ce navigateur pour le moment. Aucune donnée n’est envoyée à un service externe.</p>
    </section>
  );
}
