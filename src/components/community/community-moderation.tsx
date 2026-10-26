"use client";

import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { useCallback, useEffect, useState } from "react";

type Report = {
  id: string;
  reason: string;
  status: "open" | "reviewed" | "dismissed";
  created_at: string;
  messages: {
    id: string;
    channel_id: string;
    content: string;
    created_at: string;
    community_members: { display_name: string } | { display_name: string }[] | null;
  } | null;
};

type Payload = { reports?: Report[]; error?: string };

function authorName(report: Report) {
  const value = report.messages?.community_members;
  const member = Array.isArray(value) ? value[0] : value;
  return member?.display_name ?? "Membre SkillFlow";
}

export function CommunityModeration() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/community/reports", { cache: "no-store" });
      const payload = await response.json() as Payload;
      if (!response.ok) throw new Error(payload.error ?? "Impossible de charger les signalements.");
      setReports(payload.reports ?? []);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de charger les signalements.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void refresh(); }, 0); return () => window.clearTimeout(timer); }, [refresh]);

  async function handle(reportId: string, action: "dismiss" | "remove_message") {
    setPendingId(reportId);
    setError("");
    try {
      const response = await fetch(`/api/community/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Impossible de traiter le signalement.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de traiter le signalement.");
    } finally {
      setPendingId(null);
    }
  }

  return <main className="mx-auto max-w-5xl">
    <BackLink href="/community">Retour à la communauté</BackLink>
    <div className="mt-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Équipe SkillFlow</p><h1 className="mt-2 text-3xl font-bold text-white">Signalements</h1><p className="mt-2 text-sm text-slate-400">Examinez les messages signalés par les membres.</p></div><button type="button" onClick={() => void refresh()} disabled={loading} className="rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-cyan-300 disabled:opacity-50">Actualiser</button></div>
    {error && <p role="alert" className="mt-5 rounded-xl border border-rose-300/30 bg-rose-300/10 p-4 text-sm text-rose-100">{error}</p>}
    {loading ? <p role="status" className="mt-8 text-sm text-slate-400">Chargement des signalements…</p> : reports.length === 0 ? <section className="mt-7 rounded-2xl border border-slate-700 bg-[#101a2b] p-8 text-center"><p className="font-semibold text-white">La file est vide</p><p className="mt-2 text-sm text-slate-400">Aucun signalement ouvert pour le moment.</p></section> : <ul className="mt-7 space-y-4">{reports.map((report) => <li key={report.id} className="rounded-2xl border border-slate-700 bg-[#101a2b] p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-amber-200">Motif du signalement</p><p className="mt-1 text-sm text-slate-100">{report.reason}</p></div><time className="text-xs text-slate-500" dateTime={report.created_at}>{new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(report.created_at))}</time></div>{report.messages ? <blockquote className="mt-4 rounded-xl border-l-2 border-slate-500 bg-[#0b1220] p-4"><p className="text-xs font-semibold text-cyan-200">{authorName(report)}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-200">{report.messages.content}</p></blockquote> : <p className="mt-4 text-sm text-slate-400">Le message n’est plus disponible.</p>}<div className="mt-4 flex flex-wrap items-center justify-between gap-3"><Link href={report.messages ? `/community/channels/${report.messages.channel_id}` : "/community"} className="text-sm font-semibold text-cyan-200 hover:text-white">Ouvrir le salon →</Link><div className="flex flex-wrap gap-2"><button type="button" disabled={pendingId === report.id} onClick={() => void handle(report.id, "dismiss")} className="min-h-10 rounded-full border border-slate-600 px-4 text-sm font-semibold text-slate-200 hover:border-slate-400 disabled:opacity-50">Classer sans suite</button>{report.messages && <button type="button" disabled={pendingId === report.id} onClick={() => void handle(report.id, "remove_message")} className="min-h-10 rounded-full bg-rose-300 px-4 text-sm font-bold text-slate-950 hover:bg-rose-200 disabled:opacity-50">Retirer le message</button>}</div></div></li>)}</ul>}
  </main>;
}
