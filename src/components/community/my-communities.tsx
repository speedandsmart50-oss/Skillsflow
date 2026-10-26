"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";

type Community = { id: string; name: string; description: string; myRole: string; memberCount: number };
const fieldClass = "min-h-12 w-full rounded-xl border border-[#29425D] bg-[#07111F] px-4 py-3 text-sm text-[#F4F7FC] outline-none transition placeholder:text-[#71849A] focus:border-[#20DDF2] focus:ring-2 focus:ring-[#20DDF2]/15";
const buttonClass = "inline-flex min-h-11 items-center justify-center rounded-xl bg-[#20DDF2] px-5 py-2.5 text-sm font-bold text-[#06131F] transition duration-200 hover:-translate-y-0.5 hover:bg-[#70E9F5] hover:shadow-[0_8px_22px_rgba(32,221,242,.16)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#70E9F5] disabled:cursor-wait disabled:opacity-60";

export function MyCommunities() {
  const query = useSearchParams();
  const router = useRouter();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [inviteToken, setInviteToken] = useState(query.get("invite") ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/community/my", { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setCommunities(data.communities ?? []);
    else setError(data.error ?? "Impossible de charger vos communautés.");
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>, action: "create" | "join") {
    event.preventDefault(); setPending(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/community/my", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action === "create" ? { action, name, description } : { action, inviteToken: inviteToken.trim().split("/").pop()?.split("?")[0] }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Une erreur est survenue.");
      if (action === "create") router.push(`/community/my/${data.communityId}`);
      else { setNotice("Vous avez rejoint la communauté."); setInviteToken(""); await load(); }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Une erreur est survenue."); }
    finally { setPending(false); }
  }

  return <main className="animate-rise space-y-7 pb-10">
    <section className="relative overflow-hidden rounded-2xl border border-[#203650] bg-[radial-gradient(ellipse_at_90%_0%,rgba(32,221,242,.10),transparent_40%),linear-gradient(135deg,#0B1729,#0E1D32)] p-6 sm:p-8 lg:p-10">
      <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#70E9F5]">Votre espace d’équipe</p>
      <h1 className="mt-3 text-3xl font-bold tracking-[-.035em] text-[#F4F7FC] sm:text-4xl">Mes communautés</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#A8B7CB] sm:text-base">Créez un espace privé pour vos partenaires, partagez les échanges et avancez avec des actions concrètes.</p>
      <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-[#B9C9D9]"><span className="rounded-full border border-[#29425D] bg-[#07111F]/50 px-3 py-1.5">Privé aux membres invités</span><span className="rounded-full border border-[#29425D] bg-[#07111F]/50 px-3 py-1.5">Un membre peut rejoindre plusieurs équipes</span></div>
    </section>
    {error && <p role="alert" className="rounded-xl border border-rose-300/25 bg-rose-300/[.07] p-4 text-sm text-rose-100">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-300/25 bg-emerald-300/[.07] p-4 text-sm text-emerald-100">{notice}</p>}
    <section className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(18rem,.95fr)]">
      <form onSubmit={(event) => void submit(event, "create")} className="rounded-2xl border border-[#203650] bg-[#0B1729] p-5 sm:p-6">
        <div className="mb-5"><p className="text-xs font-bold uppercase tracking-[.15em] text-[#70E9F5]">À vous de jouer</p><h2 className="mt-1 text-xl font-bold text-white">Créer une communauté</h2><p className="mt-2 text-sm leading-6 text-[#91A4B9]">Donnez un nom à votre équipe et invitez vos partenaires avec un lien privé.</p></div>
        <label className="mb-4 grid gap-2 text-sm font-semibold text-[#DCE6F0]">Nom de l’équipe<input required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex. Équipe Horizon" className={fieldClass} /></label>
        <label className="mb-5 grid gap-2 text-sm font-semibold text-[#DCE6F0]">Présentation <span className="text-xs font-normal text-[#91A4B9]">Facultatif</span><textarea maxLength={500} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Quel est l’objectif de votre communauté ?" className={`${fieldClass} resize-y`} /></label>
        <button disabled={pending} className={buttonClass}>{pending ? "Création…" : "Créer mon espace"}</button>
      </form>
      <form onSubmit={(event) => void submit(event, "join")} className="rounded-2xl border border-[#203650] bg-[#0B1729] p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[.15em] text-[#70E9F5]">Vous avez reçu une invitation ?</p><h2 className="mt-1 text-xl font-bold text-white">Rejoindre une équipe</h2><p className="mt-2 mb-5 text-sm leading-6 text-[#91A4B9]">Collez le lien ou le code transmis par le responsable de la communauté.</p>
        <label className="mb-4 grid gap-2 text-sm font-semibold text-[#DCE6F0]">Lien ou code d’invitation<input required value={inviteToken} onChange={(event) => setInviteToken(event.target.value)} placeholder="Collez votre invitation" className={fieldClass} /></label>
        <button disabled={pending} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#29425D] bg-[#0E1D32] px-5 py-2.5 text-sm font-bold text-[#DCE6F0] transition hover:-translate-y-0.5 hover:border-[#20DDF2]/50 hover:text-[#70E9F5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#70E9F5] disabled:opacity-60">Rejoindre la communauté</button>
      </form>
    </section>
    <section aria-labelledby="my-communities-title"><div className="mb-4 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#70E9F5]">Vos espaces</p><h2 id="my-communities-title" className="mt-1 text-2xl font-bold text-white">Les équipes que vous avez rejointes</h2></div><span className="rounded-full border border-[#203650] bg-[#0B1729] px-3 py-1.5 text-xs font-semibold text-[#A8B7CB]">{communities.length} espace{communities.length === 1 ? "" : "s"}</span></div>
      {communities.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{communities.map((community, index) => <Link key={community.id} href={`/community/my/${community.id}`} style={{ animationDelay: `${index * 45}ms` }} className="group animate-rise rounded-2xl border border-[#203650] bg-[#0B1729] p-5 transition duration-200 hover:-translate-y-1 hover:border-[#20DDF2]/45 hover:bg-[#0E1D32] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#70E9F5]"><div className="flex items-start justify-between gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#20DDF2]/20 bg-[#20DDF2]/[.07] text-lg font-bold text-[#70E9F5]">{community.name.slice(0, 1).toUpperCase()}</span><span className="rounded-full border border-[#29425D] px-2.5 py-1 text-[11px] font-semibold capitalize text-[#A8B7CB]">{community.myRole === "owner" ? "Responsable" : community.myRole === "manager" ? "Gestionnaire" : "Membre"}</span></div><h3 className="mt-4 text-lg font-bold text-white transition-colors group-hover:text-[#70E9F5]">{community.name}</h3><p className="mt-1 min-h-10 text-sm leading-5 text-[#91A4B9]">{community.description || "Un espace pour échanger et avancer ensemble."}</p><div className="mt-4 flex items-center justify-between border-t border-[#203650] pt-4 text-xs font-medium text-[#A8B7CB]"><span>{community.memberCount} membre{community.memberCount === 1 ? "" : "s"}</span><span className="text-[#70E9F5]">Ouvrir l’espace <span aria-hidden="true">→</span></span></div></Link>)}</div> : <div className="rounded-2xl border border-dashed border-[#29425D] bg-[#0B1729]/60 p-7 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#20DDF2]/[.07] text-xl text-[#70E9F5]">✦</span><h3 className="mt-3 font-bold text-white">Votre premier espace commence ici</h3><p className="mx-auto mt-1 max-w-md text-sm leading-6 text-[#91A4B9]">Créez votre communauté ou rejoignez une équipe pour commencer à partager et organiser le travail.</p></div>}
    </section>
  </main>;
}
