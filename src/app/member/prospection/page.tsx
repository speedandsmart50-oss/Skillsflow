import Link from "next/link";
import { connection } from "next/server";
import { requirePageUser } from "@/lib/security/page-auth";

export const instant = false;

const modules = [
  ["01", "Leads", "Retrouvez et organisez vos contacts, leurs sources et les prochaines étapes.", "◎"],
  ["02", "Pipelines", "Visualisez les étapes de vos conversations et gardez le suivi au même endroit.", "▥"],
  ["03", "Vidéos", "Accédez aux vidéos de présentation et aux supports associés à vos échanges.", "▷"],
  ["04", "Formations", "Retrouvez les ressources de formation liées à votre activité de prospection.", "⌘"],
  ["05", "Statistiques", "Consultez vos indicateurs d’activité et suivez vos pipelines.", "↗"],
];

export default async function MemberProspectionPage() {
  await connection();
  await requirePageUser("/member/prospection");

  return <main className="min-h-screen bg-[#07111F] px-4 py-8 text-[#F4F7FC] sm:px-6 sm:py-12">
    <div className="mx-auto max-w-6xl">
      <Link href="/account" className="inline-flex min-h-11 items-center text-sm font-semibold text-[#70E9F5] transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#70E9F5]">← Retour à mon espace</Link>
      <section className="relative mt-6 overflow-hidden rounded-[2rem] border border-[#203650] bg-[radial-gradient(ellipse_at_85%_5%,rgba(32,221,242,.14),transparent_38%),linear-gradient(135deg,#0B1729,#0E1D32)] p-6 sm:p-10">
        <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#20DDF2]">Espace SkillFlow</p><h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">SkillFlow Prospection</h1><p className="mt-4 max-w-2xl text-base leading-7 text-[#A8B7CB] sm:text-lg">Votre espace de suivi commercial : contacts, pipelines, vidéos, formations et statistiques, réunis au même endroit.</p></div>
          <a href="https://app.clarkup.com" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#20DDF2] px-6 py-3 text-sm font-bold text-[#07111F] transition duration-200 hover:-translate-y-0.5 hover:bg-[#70E9F5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#70E9F5]">Ouvrir mon espace ClarkUp <span aria-hidden="true">↗</span></a>
        </div>
        <p className="relative mt-7 border-t border-white/10 pt-4 text-xs leading-5 text-[#A8B7CB]">Cette entrée ouvre ClarkUp dans un nouvel onglet. La connexion des comptes et la synchronisation des données ne sont pas configurées dans SkillFlow.</p>
      </section>
      <section className="mt-10 sm:mt-14" aria-labelledby="prospection-modules">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#70E9F5]">Votre boîte à outils</p><h2 id="prospection-modules" className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Un espace pour garder le cap</h2></div><p className="max-w-lg text-sm leading-6 text-[#A8B7CB]">Les modules ci-dessous sont accessibles depuis votre compte ClarkUp.</p></div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{modules.map(([number, title, description, icon]) => <article key={number} className="group rounded-2xl border border-[#203650] bg-[#0B1729] p-5 transition duration-200 hover:-translate-y-1 hover:border-[#20DDF2]/50 hover:bg-[#0E1D32] sm:p-6"><div className="flex items-start justify-between"><span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#20DDF2]/20 bg-[#20DDF2]/[.08] text-xl font-semibold text-[#70E9F5] transition duration-200 group-hover:rotate-3 group-hover:scale-105">{icon}</span><span className="text-xs font-semibold tracking-widest text-[#71859C]">{number}</span></div><h3 className="mt-5 text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-[#A8B7CB]">{description}</p><p className="mt-5 text-xs font-semibold text-[#70E9F5]">Disponible dans ClarkUp</p></article>)}</div>
      </section>
    </div>
  </main>;
}
