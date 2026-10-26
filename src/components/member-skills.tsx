"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

type Skill = { id: string; slug: string; name: string; short_description: string; long_description: string; category_id: string; product_id?: string | null; price_cents: number; accessible: boolean; required_inputs: string[]; output_types: string[]; workflow: string[]; skill_categories?: { name: string; slug: string } | null };
type Detail = { skill: Skill; configuration: { configuration_data: Record<string, string>; status: string } | null };
const card = "rounded-3xl border border-white/10 bg-[#111a2b] p-5 shadow-xl sm:p-7";
const field = "w-full rounded-xl border border-white/15 bg-[#0b1524] px-4 py-3 text-white outline-none focus:ring-2 focus:ring-cyan-300";

async function api<T = Record<string, unknown>>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await getSupabaseClient().auth.getSession();
  if (!data.session) throw new Error("Reconnectez-vous pour continuer.");
  const response = await fetch(path, { ...init, headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${data.session.access_token}`, ...(init?.body ? { "Content-Type": "application/json" } : {}) }, cache: "no-store" });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string" ? payload.error : `La requête a échoué (${response.status}).`;
    throw new Error(message);
  }
  if (typeof payload !== "object" || payload === null) throw new Error("Réponse invalide du serveur.");
  return payload as T;
}

export function MemberSkills({ skillId }: { skillId?: string }) {
  const [items, setItems] = useState<Skill[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    try {
      const result = await api<{ items: Skill[] }>("/api/member/skills");
      setItems(result.items);
      if (skillId) {
        const found = result.items.find((item: Skill) => item.id === skillId || item.slug === skillId);
        if (!found) throw new Error("Skill introuvable.");
        const response = await api<Detail>(`/api/member/skills/${found.id}`);
        setDetail(response);
        setForm(response.configuration?.configuration_data ?? {});
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Chargement impossible."); }
    finally { setLoading(false); }
  }, [skillId]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!detail) return;
    setPending(true); setError("");
    try {
      const result = await api<{ configuration: NonNullable<Detail["configuration"]> }>(`/api/member/skills/${detail.skill.id}`, { method: "PUT", body: JSON.stringify({ configuration: form }) });
      setDetail({ ...detail, configuration: result.configuration });
      setNotice("Configuration enregistrée dans votre espace privé.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Enregistrement impossible."); }
    finally { setPending(false); }
  }

  return <main className="min-h-screen bg-[#0b1020] px-4 py-8 text-slate-100 sm:px-8"><div className="mx-auto max-w-6xl">
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4"><Link href="/account" className="font-semibold text-cyan-200">← Espace SkillFlow</Link><Link href="/member/skills" className="text-sm text-slate-300">Tous les skills</Link></header>
    <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">SkillFlow · espace membre</p><h1 className="mt-2 font-[family-name:var(--font-bricolage)] text-3xl font-semibold sm:text-4xl">{skillId ? detail?.skill.name ?? "Votre skill" : "Bibliothèque de skills"}</h1><p className="mt-3 max-w-2xl text-slate-300">Configurez vos outils métier. Vos réglages restent privés à votre compte.</p>
    <Link href="/member/prospection" className="mt-5 inline-flex min-h-11 items-center rounded-full border border-cyan-200/20 bg-cyan-200/[.06] px-4 text-sm font-semibold text-cyan-100 transition hover:-translate-y-0.5 hover:border-cyan-200/50 hover:bg-cyan-200/[.1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200">Ouvrir SkillFlow Prospection <span aria-hidden="true" className="ml-2">↗</span></Link>
    {error && <p role="alert" className="mt-6 rounded-2xl border border-rose-300/30 bg-rose-300/10 p-4 text-rose-100">{error}</p>}{notice && <p role="status" className="mt-6 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-4 text-cyan-100">{notice}</p>}
    {loading ? <p className="mt-8 text-slate-400">Chargement…</p> : detail ? <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_19rem]"><section className={card}><span className="rounded-full bg-cyan-300/10 px-3 py-1 text-sm text-cyan-200">{detail.skill.skill_categories?.name ?? "Skill"}</span><p className="mt-5 text-slate-300">{detail.skill.long_description}</p><h2 className="mt-7 text-xl font-semibold">Configurez votre contexte</h2><form onSubmit={(event) => void save(event)} className="mt-4 space-y-4">{(detail.skill.required_inputs ?? []).map((raw) => { const name = String(raw); return <label key={name} className="block text-sm font-medium capitalize text-slate-200">{name.replaceAll("_", " ")}<textarea className={`${field} mt-2 min-h-24 resize-y`} value={form[name] ?? ""} onChange={(event) => setForm({ ...form, [name]: event.target.value })} maxLength={5000} /></label>; })}<button disabled={pending} className="rounded-full bg-cyan-300 px-5 py-3 font-bold text-slate-950 disabled:opacity-60">{pending ? "Enregistrement…" : "Enregistrer mon profil de travail"}</button></form></section><aside className="space-y-4"><div className={card}><h2 className="font-semibold">Parcours conseillé</h2><ol className="mt-3 space-y-3 text-sm text-slate-300">{detail.skill.workflow?.map((step, index) => <li key={step} className="flex gap-3"><span className="text-cyan-300">{String(index + 1).padStart(2, "0")}</span>{step}</li>)}</ol></div><div className={card}><h2 className="font-semibold">Livrables possibles</h2><ul className="mt-3 space-y-2 text-sm text-slate-300">{detail.skill.output_types?.map((item) => <li key={item}>· {item.replaceAll("_", " ")}</li>)}</ul><p className="mt-4 text-xs leading-5 text-amber-100/80">La sauvegarde du profil fonctionne. La génération IA attend la configuration d’un fournisseur.</p></div><Link href={`/member/skills/${detail.skill.id}/agent`} className="block rounded-2xl border border-cyan-200/20 p-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-200/10">Ouvrir l’agent →</Link></aside></div> : <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => <article key={item.id} className={`${card} transition duration-300 hover:-translate-y-1 hover:border-cyan-200/30`}><p className="text-xs font-bold uppercase tracking-wider text-cyan-300">{item.skill_categories?.name ?? "Skill IA"}</p><h2 className="mt-3 text-xl font-semibold">{item.name}</h2><p className="mt-2 min-h-16 text-sm leading-6 text-slate-300">{item.short_description}</p><div className="mt-5 flex items-center justify-between gap-3"><div className="text-right"><p className="text-sm font-bold text-white">{String.fromCharCode(8364)}{(item.price_cents / 100).toFixed(2)}</p><p className="text-xs text-slate-400">{new Intl.NumberFormat("fr-FR").format(Math.round((item.price_cents / 100) * 655.957))} XOF</p>{item.accessible && <p className="mt-1 text-xs text-cyan-200">Acc&#232;s inclus</p>}{!item.accessible && !item.product_id && <p className="mt-1 text-xs text-amber-200">En pr&eacute;paration</p>}</div><Link href={item.accessible ? `/member/skills/${item.id}/setup` : item.product_id ? `/products/${item.slug}` : "/shop"} className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950">{item.accessible ? "Configurer" : item.product_id ? "Voir l’accès" : "Catalogue"}</Link></div></article>)}</div>}
  </div></main>;
}
