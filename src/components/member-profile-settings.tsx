"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useMemberPreferences, type DashboardTheme } from "@/components/member-preferences-provider";

const themes: { id: DashboardTheme; name: string; detail: string; swatches: string[] }[] = [
  { id: "midnight", name: "Nuit", detail: "Le thème SkillFlow classique", swatches: ["#0b1020", "#111a2b", "#22d3ee"] },
  { id: "ocean", name: "Océan", detail: "Des bleus profonds et apaisants", swatches: ["#071a2b", "#0d263c", "#54ddeb"] },
  { id: "violet", name: "Violet", detail: "Une ambiance indigo et lavande", swatches: ["#141126", "#211b3d", "#bea9ff"] },
  { id: "light", name: "Clair", detail: "Une lecture lumineuse et douce", swatches: ["#f4f7fb", "#ffffff", "#087f8c"] },
];

export function MemberProfileSettings() {
  const { profile, loading, saveProfile, uploadAvatar, removeAvatar } = useMemberPreferences();
  const [name, setName] = useState("");
  const [theme, setTheme] = useState<DashboardTheme>("midnight");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;
    setName(profile.displayName);
    setTheme(profile.theme);
  }, [profile]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage(""); setError("");
    try { await saveProfile({ displayName: name, theme }); setMessage("Votre profil et votre thème sont enregistrés."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Enregistrement impossible."); }
    finally { setPending(false); }
  }

  async function selectAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]; event.currentTarget.value = "";
    if (!file) return;
    setPending(true); setMessage(""); setError("");
    try { await uploadAvatar(file); setMessage("Votre photo de profil a été mise à jour."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Téléversement impossible."); }
    finally { setPending(false); }
  }

  async function clearAvatar() {
    setPending(true); setMessage(""); setError("");
    try { await removeAvatar(); setMessage("Votre photo de profil a été supprimée."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Suppression impossible."); }
    finally { setPending(false); }
  }

  const initials = (name || profile?.email || "M").trim().slice(0, 1).toUpperCase();
  return <main className="min-h-screen bg-[#0b1020] px-4 py-8 text-slate-100 sm:px-8"><div className="mx-auto max-w-5xl">
    <Link className="text-sm font-semibold text-cyan-200 transition hover:text-white" href="/member/skills">← Retour à mes skills</Link>
    <header className="mt-7 max-w-3xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Espace membre · Personnalisation</p><h1 className="mt-2 font-[family-name:var(--font-bricolage)] text-3xl font-semibold sm:text-4xl">Votre profil et vos réglages</h1><p className="mt-3 leading-7 text-slate-300">Choisissez comment votre espace SkillFlow vous accompagne. Vos préférences restent liées à votre compte.</p></header>
    {(error || message) && <p role={error ? "alert" : "status"} className={`mt-6 rounded-2xl border p-4 text-sm ${error ? "border-rose-300/30 bg-rose-300/10 text-rose-100" : "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"}`}>{error || message}</p>}
    {loading ? <p role="status" className="mt-8 text-slate-400">Chargement de votre profil…</p> : <div className="mt-7 grid gap-5 lg:grid-cols-[.82fr_1.18fr]">
      <section className="rounded-3xl border border-white/10 bg-[#111a2b] p-6 sm:p-8"><h2 className="text-xl font-semibold">Photo de profil</h2><p className="mt-2 text-sm leading-6 text-slate-300">Une image pour vous reconnaître dans votre espace membre.</p>
        <div className="mt-6 flex flex-wrap items-center gap-5"><div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-cyan-200/30 bg-cyan-300/10 text-3xl font-bold text-cyan-100" aria-label={profile?.avatarUrl ? "Photo de profil actuelle" : "Initiale du profil"}>
          {profile?.avatarUrl ? <Image src={profile.avatarUrl} alt="Votre photo de profil" width={96} height={96} unoptimized className="h-full w-full object-cover" /> : initials}
        </div><div className="flex flex-col items-start gap-2"><button type="button" disabled={pending} onClick={() => fileRef.current?.click()} className="min-h-11 rounded-full bg-cyan-300 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-cyan-200 disabled:opacity-60">{pending ? "Veuillez patienter…" : "Choisir une photo"}</button>
          {profile?.avatarUrl && <button type="button" disabled={pending} onClick={() => void clearAvatar()} className="min-h-10 px-2 text-sm text-slate-300 underline decoration-white/30 underline-offset-4 transition hover:text-white disabled:opacity-60">Supprimer la photo</button>}
          <span className="text-xs text-slate-400">JPG, PNG ou WebP · 3 Mo maximum</span><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void selectAvatar(event)} className="sr-only" aria-label="Choisir une photo de profil" />
        </div></div><div className="mt-7 border-t border-white/10 pt-6"><p className="text-sm text-slate-400">Adresse du compte</p><p className="mt-1 break-all font-medium text-slate-100">{profile?.email}</p></div>
      </section>
      <section className="rounded-3xl border border-white/10 bg-[#111a2b] p-6 sm:p-8"><h2 className="text-xl font-semibold">Apparence du tableau de bord</h2><p className="mt-2 text-sm leading-6 text-slate-300">Le thème choisi est mémorisé sur votre compte et suit vos connexions.</p>
        <form onSubmit={(event) => void save(event)}><label htmlFor="member-display-name" className="mt-6 block text-sm font-semibold">Nom de profil</label><input id="member-display-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} autoComplete="nickname" placeholder="Comment souhaitez-vous être appelé ?" className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#0b1524] px-4 text-base text-white outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-300" />
          <fieldset className="mt-7"><legend className="text-sm font-semibold">Choisir un thème</legend><div className="mt-3 grid gap-3 sm:grid-cols-2">{themes.map((option) => <label key={option.id} className={`group flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-200/50 ${theme === option.id ? "border-cyan-300/70 bg-cyan-300/[.07]" : "border-white/10 bg-[#0b1524]"}`}>
            <input type="radio" name="dashboard-theme" value={option.id} checked={theme === option.id} onChange={() => setTheme(option.id)} className="sr-only" /><span className="flex h-12 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10" aria-hidden="true">{option.swatches.map((color) => <span key={color} className="h-full flex-1" style={{ backgroundColor: color }} />)}</span>
            <span className="min-w-0"><span className="block font-semibold">{option.name}</span><span className="mt-0.5 block text-xs text-slate-400">{option.detail}</span></span><span className={`ml-auto h-4 w-4 shrink-0 rounded-full border ${theme === option.id ? "border-cyan-300 bg-cyan-300 ring-2 ring-cyan-300/20" : "border-slate-500"}`} aria-hidden="true" />
          </label>)}</div></fieldset><button type="submit" disabled={pending} className="mt-7 min-h-12 rounded-full bg-cyan-300 px-6 py-3 font-bold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-cyan-200 disabled:opacity-60">{pending ? "Enregistrement…" : "Enregistrer mes réglages"}</button>
        </form>
      </section>
    </div>}
  </div></main>;
}
