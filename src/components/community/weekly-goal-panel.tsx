"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

type WeeklyGoal = { id: string; title: string; description: string; week_start: string };
type Task = { id: string; label: string; position: number };
type MemberProgress = { name: string; completedCount: number; totalCount: number; percentage: number; isCurrentUser: boolean };
type Payload = { goal?: WeeklyGoal | null; tasks?: Task[]; myCompletedTaskIds?: string[]; members?: MemberProgress[]; isStaff?: boolean; error?: string };

const panelClass = "rounded-3xl border border-cyan-300/20 bg-[radial-gradient(ellipse_at_top_left,rgba(34,211,238,.12),transparent_45%),linear-gradient(135deg,#111c2e,#0b1220_70%)] p-5 shadow-[0_18px_60px_rgba(0,0,0,.2)] sm:p-7 lg:col-span-2";

function ProgressBar({ percentage, label }: { percentage: number; label: string }) {
  return <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage} className="h-2.5 overflow-hidden rounded-full bg-slate-800">
    <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-300 transition-[width] duration-700 ease-out" style={{ width: `${percentage}%` }} />
  </div>;
}

export function WeeklyGoalPanel() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingTask, setPendingTask] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taskText, setTaskText] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/community/weekly-goal", { cache: "no-store" });
      const next = await response.json() as Payload;
      if (!response.ok) throw new Error(next.error ?? "Impossible de charger le suivi hebdomadaire.");
      setPayload(next);
      if (next.goal && !editing) {
        setTitle(next.goal.title);
        setDescription(next.goal.description);
        setTaskText((next.tasks ?? []).map((task) => task.label).join("\n"));
      }
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de charger le suivi hebdomadaire.");
    } finally {
      setLoading(false);
    }
  }, [editing]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    const client = getSupabaseClient();
    const subscription = client.channel("community-weekly-goal-progress")
      .on("postgres_changes", { event: "*", schema: "public", table: "community_weekly_goal_checks" }, () => { void refresh(); })
      .subscribe();
    const interval = window.setInterval(() => { void refresh(); }, 30_000);
    return () => { window.clearTimeout(timer); window.clearInterval(interval); void client.removeChannel(subscription); };
  }, [refresh]);

  const myCompleted = useMemo(() => new Set(payload?.myCompletedTaskIds ?? []), [payload?.myCompletedTaskIds]);
  const tasks = payload?.tasks ?? [];
  const completedCount = tasks.filter((task) => myCompleted.has(task.id)).length;
  const percentage = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;
  const weekLabel = payload?.goal ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${payload.goal.week_start}T12:00:00Z`)) : "";

  async function toggleTask(task: Task) {
    if (pendingTask) return;
    setPendingTask(task.id);
    setError("");
    try {
      const response = await fetch("/api/community/weekly-goal", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, completed: !myCompleted.has(task.id) }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Impossible de mettre à jour cette action.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de mettre à jour cette action.");
    } finally {
      setPendingTask(null);
    }
  }

  async function saveGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTasks = taskText.split("\n").map((task) => task.trim()).filter(Boolean);
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/community/weekly-goal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, tasks: cleanTasks }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Impossible d’enregistrer l’objectif.");
      setEditing(false);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible d’enregistrer l’objectif.");
    } finally {
      setSaving(false);
    }
  }

  const members = [...(payload?.members ?? [])].sort((a, b) => Number(b.isCurrentUser) - Number(a.isCurrentUser) || a.name.localeCompare(b.name, "fr"));

  return <section className={panelClass} aria-labelledby="weekly-goal-title">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Cap collectif · cette semaine</p>
        <h2 id="weekly-goal-title" className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">Objectif de la semaine</h2>
        <p className="mt-2 text-sm text-slate-300">Un pas après l’autre, chacun avance à son rythme.</p>
      </div>
      {payload?.goal && <div className="rounded-2xl border border-cyan-300/20 bg-slate-950/40 px-4 py-3 text-right"><p className="text-xs text-slate-400">Semaine du</p><p className="mt-1 text-sm font-semibold text-cyan-100">{weekLabel}</p></div>}
    </div>

    {error && <p role="alert" className="mt-5 rounded-xl border border-rose-300/30 bg-rose-300/10 p-3 text-sm text-rose-100">{error}</p>}
    {loading ? <p role="status" className="mt-6 text-sm text-slate-300">Chargement de l’objectif…</p> : !payload?.goal ? <div className="mt-6 rounded-2xl border border-dashed border-slate-600 bg-slate-950/30 p-5 sm:p-6">
      {payload?.isStaff ? <>
        <p className="font-semibold text-white">Lancez le premier objectif collectif</p>
        <p className="mt-1 text-sm leading-6 text-slate-300">Choisissez un cap pour cette semaine et décomposez-le en actions simples.</p>
        {!editing && <button type="button" onClick={() => { setEditing(true); setTaskText(""); }} className="mt-4 rounded-full bg-cyan-300 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-200">Définir l’objectif</button>}
      </> : <><p className="font-semibold text-white">Le prochain objectif se prépare</p><p className="mt-1 text-sm text-slate-300">L’équipe publiera ici le cap et les actions de la semaine.</p></>}
    </div> : <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
      <div className="rounded-2xl border border-slate-700/80 bg-slate-950/35 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl"><h3 className="text-xl font-bold leading-snug text-white sm:text-2xl">{payload.goal.title}</h3>{payload.goal.description && <p className="mt-2 text-sm leading-6 text-slate-300">{payload.goal.description}</p>}</div>
          <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full border-4 border-cyan-300/70 bg-cyan-300/[.07] shadow-[0_0_25px_rgba(34,211,238,.12)]" role="progressbar" aria-label="Votre progression de la semaine" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}><span className="text-xl font-black text-white">{percentage}%</span><span className="text-[10px] font-semibold uppercase tracking-wide text-cyan-100">vous</span></div>
        </div>
        <div className="mt-5 flex items-center justify-between gap-2 text-xs text-slate-400"><span>Votre progression</span><span className="font-semibold text-cyan-100">{completedCount}/{tasks.length} actions</span></div>
        <div className="mt-2"><ProgressBar percentage={percentage} label={`Votre progression : ${percentage} pour cent`} /></div>
        <ul className="mt-5 grid gap-2.5">
          {tasks.map((task, index) => {
            const checked = myCompleted.has(task.id);
            return <li key={task.id}><label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${checked ? "border-emerald-300/25 bg-emerald-300/[.06]" : "border-slate-700 bg-[#111c2e] hover:border-cyan-300/40"}`}><input type="checkbox" checked={checked} disabled={pendingTask !== null} onChange={() => void toggleTask(task)} className="mt-0.5 h-5 w-5 shrink-0 accent-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"/><span className="flex-1 text-sm leading-6 text-slate-100">{task.label}</span><span className="text-xs font-bold tabular-nums text-slate-500">{String(index + 1).padStart(2, "0")}</span></label></li>;
          })}
        </ul>
        <p className="mt-4 text-xs leading-5 text-slate-400">Cochez une action une fois réalisée. Vous pouvez mettre à jour votre suivi à tout moment.</p>
      </div>

      <div className="rounded-2xl border border-slate-700/80 bg-slate-950/35 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-white">Avancement des membres</h3><p className="mt-1 text-xs text-slate-400">Mis à jour automatiquement · {members.length} membre{members.length > 1 ? "s" : ""}</p></div><span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-300/10 text-lg text-cyan-200">↗</span></div>
        {members.length === 0 ? <p className="mt-5 text-sm text-slate-400">Aucun membre inscrit dans ce salon pour le moment.</p> : <ul className="mt-5 max-h-[380px] space-y-4 overflow-y-auto pr-1">{members.map((member, index) => <li key={`${member.name}-${index}`} className="rounded-xl border border-slate-800 bg-[#111c2e]/70 p-3.5"><div className="mb-2 flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300/25 to-blue-400/20 text-xs font-bold text-cyan-100">{member.name.trim().slice(0, 1).toUpperCase() || "M"}</span><span className="truncate text-sm font-semibold text-slate-100">{member.name}{member.isCurrentUser ? <span className="ml-1.5 text-xs font-medium text-cyan-200">(vous)</span> : null}</span></div><span className="shrink-0 text-sm font-bold tabular-nums text-cyan-100">{member.percentage}%</span></div><ProgressBar percentage={member.percentage} label={`Progression de ${member.name} : ${member.percentage} pour cent`} /><p className="mt-1.5 text-right text-[11px] text-slate-500">{member.completedCount}/{member.totalCount} actions</p></li>)}</ul>}
        <p className="mt-4 border-t border-slate-800 pt-3 text-xs leading-5 text-slate-500">Le suivi est partagé entre les membres autorisés du salon. Chaque personne avance à son rythme.</p>
      </div>
    </div>}

    {payload?.isStaff && payload.goal && !editing && <button type="button" onClick={() => setEditing(true)} className="mt-5 rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-300 hover:text-cyan-100">Modifier l’objectif de la semaine</button>}
    {editing && payload?.isStaff && <form onSubmit={(event) => void saveGoal(event)} className="mt-6 grid gap-4 rounded-2xl border border-cyan-300/25 bg-slate-950/50 p-5 sm:p-6">
      <div><p className="text-sm font-bold text-white">{payload.goal ? "Modifier l’objectif" : "Configurer l’objectif"}</p><p className="mt-1 text-xs leading-5 text-slate-400">Les actions inchangées gardent leur progression. Si une action est modifiée ou retirée, son suivi repart de zéro ou disparaît.</p></div>
      <label className="grid gap-1.5 text-sm font-semibold text-slate-200">Objectif de la semaine<input value={title} onChange={(event) => setTitle(event.target.value)} minLength={3} maxLength={140} required placeholder="Ex. Installer une routine de suivi" className="min-h-11 rounded-xl border border-slate-600 bg-[#0b1220] px-3 text-white placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" /></label>
      <label className="grid gap-1.5 text-sm font-semibold text-slate-200">Contexte ou conseil <span className="text-xs font-normal text-slate-400">Facultatif · 500 caractères maximum</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={2} placeholder="Quelques mots pour donner le cap…" className="rounded-xl border border-slate-600 bg-[#0b1220] p-3 font-normal text-white placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" /></label>
      <label className="grid gap-1.5 text-sm font-semibold text-slate-200">Actions de la checklist <span className="text-xs font-normal text-slate-400">Une action par ligne · 1 à 12 actions</span><textarea value={taskText} onChange={(event) => setTaskText(event.target.value)} required rows={6} placeholder={"Définir une priorité pour la semaine\nBloquer un créneau de suivi\nFaire le point sur les actions réalisées"} className="rounded-xl border border-slate-600 bg-[#0b1220] p-3 font-normal leading-6 text-white placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" /></label>
      <div className="flex flex-wrap gap-2"><button type="submit" disabled={saving} className="rounded-full bg-cyan-300 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50">{saving ? "Enregistrement…" : "Publier l’objectif"}</button><button type="button" onClick={() => { setEditing(false); if (payload.goal) { setTitle(payload.goal.title); setDescription(payload.goal.description); setTaskText(tasks.map((task) => task.label).join("\n")); } }} className="rounded-full border border-slate-600 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:border-slate-400">Annuler</button></div>
    </form>}
  </section>;
}
