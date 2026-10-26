import Link from "next/link";
import { CommunityNotifications } from "@/components/community/community-notifications";

const communityLinks = [
  { label: "Accueil", href: "/community" },
  { label: "Académies", href: "/community/closing-negociation" },
  { label: "Formations", href: "/community/closing-negociation#parcours" },
  { label: "Nos valeurs", href: "/community#valeurs" },
];

const utilityLinkClass = "inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-950/20 px-3.5 text-sm font-semibold text-slate-200 transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/50 hover:bg-cyan-300/[.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300";

export function CommunityShell({ children, userId, isStaff }: { children: React.ReactNode; userId: string; isStaff: boolean }) {
  return (
    <div className="mx-auto min-h-[calc(100vh-76px)] max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <header className="mb-7 overflow-hidden rounded-3xl border border-cyan-300/15 bg-[#101a2b] shadow-[0_18px_60px_rgba(0,.22)]">
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between lg:px-7 lg:py-5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[.22em] text-cyan-300">SkillFlow <span className="mx-1.5 text-slate-600">/</span> Communauté</p>
            <h1 className="mt-1.5 text-xl font-bold tracking-tight text-white sm:text-2xl">Progressez avec méthode</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CommunityNotifications userId={userId} />
            {isStaff && <Link className={utilityLinkClass} href="/community/moderation">Modération</Link>}
            <Link className={utilityLinkClass} href="/member/skills">Mes skills</Link>
            <Link className={utilityLinkClass} href="/account">Mon compte</Link>
          </div>
        </div>
        <div className="border-t border-slate-700/70 bg-slate-950/15 px-4 py-3 sm:px-6 lg:px-7">
          <nav aria-label="Explorer la communauté" className="flex flex-wrap items-center gap-1.5">
            {communityLinks.map((item, index) => (
              <Link
                key={item.href}
                aria-current={index === 0 ? "page" : undefined}
                className={`inline-flex min-h-10 shrink-0 items-center rounded-xl px-3.5 text-sm font-semibold transition duration-300 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${index === 0 ? "bg-cyan-300 text-slate-950 shadow-[0_6px_18px_rgba(34,211,238,.13)] hover:bg-cyan-200" : "text-slate-300 hover:bg-white/[.06] hover:text-white"}`}
                href={item.href}
              >
                {item.label}
              </Link>
            ))}
            <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-slate-700 sm:block" />
            <Link className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/[.07] px-3.5 text-sm font-semibold text-cyan-100 transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/50 hover:bg-cyan-300/[.12] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300" href="/community#suggestion">
              <span aria-hidden="true" className="text-base leading-none">＋</span>
              Faire une suggestion
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
