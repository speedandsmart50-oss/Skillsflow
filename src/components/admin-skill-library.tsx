"use client";

import { BackLink } from "@/components/back-link";
import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

type LibrarySkill = { id: string; slug: string; name: string; category_id: string; short_description: string; price_cents: number; is_active: boolean; is_included_in_membership: boolean; product_id: string | null };
type Category = { id: string; name: string };
export function AdminSkillLibrary() {
  const [skills, setSkills] = useState<LibrarySkill[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState("");
  const load = useCallback(async () => {
    const { data } = await getSupabaseClient().auth.getSession();
    const response = await fetch("/api/admin/skill-library", { headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` }, cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Chargement impossible.");
    setSkills(payload.skills); setCategories(payload.categories);
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load().catch((caught) => setError(caught instanceof Error ? caught.message : "Chargement impossible.")).finally(() => setLoading(false)); }, 0); return () => window.clearTimeout(timer); }, [load]);
  async function update(skill: LibrarySkill, changes: Partial<LibrarySkill>) {
    setPending(skill.id); setError("");
    try {
      const { data } = await getSupabaseClient().auth.getSession();
      const response = await fetch("/api/admin/skill-library", { method: "PATCH", headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}`, "Content-Type": "application/json" }, body: JSON.stringify({ id: skill.id, ...changes }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Modification impossible.");
      setSkills((current) => current.map((item) => item.id === skill.id ? payload.skill : item));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Modification impossible."); }
    finally { setPending(""); }
  }
  return <main className="min-h-screen bg-[#0b1020] px-4 py-8 text-slate-100 sm:px-8"><div className="mx-auto max-w-7xl"><header className="flex items-center justify-between"><div><BackLink href="/admin">Administration</BackLink><h1 className="mt-3 text-3xl font-semibold">Bibliothèque de skills</h1><p className="mt-2 text-sm text-slate-300">Publication, rattachement aux produits et accès inclus.</p></div><span className="rounded-full border border-cyan-200/20 px-3 py-2 text-sm text-cyan-100">{skills.length} skills</span></header>{error&&<p role="alert" className="mt-5 rounded-xl bg-rose-300/10 p-4 text-rose-100">{error}</p>}{loading?<p className="mt-8 text-slate-400">Chargement…</p>:<div className="mt-7 space-y-3">{skills.map((skill)=><article key={skill.id} className="grid gap-4 rounded-2xl border border-white/10 bg-[#111a2b] p-4 lg:grid-cols-[1fr_14rem_8rem_10rem]"><div><h2 className="font-semibold">{skill.name}</h2><p className="mt-1 text-xs text-slate-400">{skill.slug}</p><p className="mt-2 text-sm text-slate-300">{skill.short_description}</p></div><label className="text-xs text-slate-400">Catégorie<select value={skill.category_id} disabled={pending===skill.id} onChange={(event)=>void update(skill,{category_id:event.target.value})} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1524] p-2 text-sm text-white">{categories.map((category)=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="text-xs text-slate-400">Prix (€)<input type="number" min="0" step="0.01" defaultValue={(skill.price_cents/100).toFixed(2)} onBlur={(event)=>{const value=Math.round(Number(event.currentTarget.value)*100);if(value!==skill.price_cents)void update(skill,{price_cents:value});}} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1524] p-2 text-sm text-white"/></label><div className="flex flex-wrap items-center gap-2"><button disabled={pending===skill.id} onClick={()=>void update(skill,{is_active:!skill.is_active})} className="rounded-full border border-white/15 px-3 py-2 text-xs">{skill.is_active?"Désactiver":"Activer"}</button><span className="text-xs text-slate-400">{skill.product_id?"Produit lié":"Pas de produit lié"}</span></div></article>)}</div>}</div></main>;
}
