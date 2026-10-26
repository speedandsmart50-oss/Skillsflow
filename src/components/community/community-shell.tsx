import Link from "next/link";
import { CommunityNotifications } from "@/components/community/community-notifications";

export function CommunityShell({ children, userId, isStaff }: { children: React.ReactNode; userId: string; isStaff: boolean }) {
  return (
    <div className="mx-auto min-h-[calc(100vh-76px)] max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <header className="mb-8 rounded-3xl border border-cyan-300/15 bg-[#101a2b] p-4 shadow-[0_18px_60px_rgba(0,0,0,.22)] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[.2em] text-cyan-300">SkillFlow <span className="mx-1 text-slate-600">/</span> Communauté</p>
            <h1 className="mt-1.5 text-xl font-bold tracking-tight text-white sm:text-2xl">Progressez avec méthode</h1>
          </div>
          <nav aria-label="Compte et outils" className="flex flex-wrap items-center gap-2">
            <CommunityNotifications userId={userId} />
            {isStaff && <Link className="rounded-xl border border-slate-700/80 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-300/50 hover:text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 sm:px-3.5 sm:text-sm" href="/community/moderation">Modération</Link>}
            <Link className="rounded-xl border border-slate-700/80 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-300/50 hover:text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 sm:px-3.5 sm:text-sm" href="/member/skills">Mes skills</Link>
            <Link className="rounded-xl border border-slate-700/80 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-300/50 hover:text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 sm:px-3.5 sm:text-sm" href="/account">Mon compte</Link>
          </nav>
        </div>
        <nav aria-label="Explorer la communauté" className="mt-4 flex gap-1 overflow-x-auto border-t border-slate-700/70 pt-3 text-sm [scrollbar-width:thin]">
          <Link className="shrink-0 rounded-lg px-3.5 py-2 font-medium text-slate-300 transition hover:bg-white/[.05] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" href="/community">Accueil</Link>
          <Link className="shrink-0 rounded-lg px-3.5 py-2 font-medium text-slate-300 transition hover:bg-white/[.05] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" href="/community/closing-negociation">Académies</Link>
          <Link className="shrink-0 rounded-lg px-3.5 py-2 font-medium text-slate-300 transition hover:bg-white/[.05] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" href="/community/closing-negociation#parcours">Formations</Link>
          <Link className="shrink-0 rounded-lg px-3.5 py-2 font-medium text-slate-300 transition hover:bg-white/[.05] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" href="/community#valeurs">Nos valeurs</Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
