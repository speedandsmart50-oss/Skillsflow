import Link from "next/link";
import { CommunityNotifications } from "@/components/community/community-notifications";

export function CommunityShell({ children, userId }: { children: React.ReactNode; userId: string }) {
  return (
    <div className="mx-auto min-h-[calc(100vh-76px)] max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-cyan-300/15 bg-[#101a2b] p-5 shadow-[0_18px_60px_rgba(0,0,0,.22)] sm:p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.22em] text-cyan-300">SkillFlow · Communauté</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">Progressez avec méthode</h1>
        </div>
        <nav aria-label="Navigation communauté" className="flex flex-wrap items-center gap-2 text-sm">
          <CommunityNotifications userId={userId} />
          <Link className="rounded-full border border-slate-700 px-4 py-2 text-slate-200 hover:border-cyan-300 hover:text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" href="/community">Accueil</Link>
          <Link className="rounded-full border border-slate-700 px-4 py-2 text-slate-200 hover:border-cyan-300 hover:text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" href="/member/skills">Mes skills</Link>
          <Link className="rounded-full border border-slate-700 px-4 py-2 text-slate-200 hover:border-cyan-300 hover:text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" href="/account">Mon compte</Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
