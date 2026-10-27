import Link from "next/link";
import { CommunityNotifications } from "@/components/community/community-notifications";
import { CommunitySectionNav } from "@/components/community/community-section-nav";

const actionClass = "inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-[#203650] bg-[#0B1729]/70 px-3.5 text-sm font-semibold text-[#C7D4E3] transition duration-200 hover:border-[#20DDF2]/50 hover:bg-[#20DDF2]/[.05] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#70E9F5]";

export function CommunityShell({ children, userId, isStaff }: { children: React.ReactNode; userId: string; isStaff: boolean }) {
  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#07111F] font-sans text-[#F4F7FC]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="mb-7 rounded-2xl border border-[#203650] bg-[#0B1729] shadow-[0_12px_36px_rgba(0,0,0,.16)]">
        <div className="flex flex-col gap-4 p-5 sm:p-6 md:flex-row md:items-center md:justify-between lg:px-7">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-[#20DDF2]"><span aria-hidden="true">⌂</span><span>SkillFlow</span><span aria-hidden="true" className="text-[#60738A]">/</span><span>Communauté</span></p>
            <h1 className="mt-1.5 text-xl font-bold tracking-[-.025em] text-[#F4F7FC] sm:text-2xl">Progressez avec méthode</h1>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link className={actionClass} href="/account">Retour à mon espace</Link>
            <CommunityNotifications userId={userId} />
            <div className="hidden items-center gap-2 md:flex">
              {isStaff && <Link className={actionClass} href="/community/moderation">Modération</Link>}
              <Link className={actionClass} href="/member/skills">Mes skills</Link>
              <Link className={actionClass} href="/account">Mon compte</Link>
            </div>
            <details className="group relative md:hidden">
              <summary className={`${actionClass} list-none cursor-pointer [&::-webkit-details-marker]:hidden`}>
                Actions <span aria-hidden="true" className="ml-2 text-xs text-[#8EA2B9] transition-transform group-open:rotate-180">⌄</span>
              </summary>
              <nav aria-label="Actions de la communauté" className="absolute right-0 z-30 mt-2 grid w-48 gap-1 rounded-xl border border-[#203650] bg-[#0B1729] p-2 shadow-2xl">
                {isStaff && <Link className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#D6E1EF] hover:bg-white/[.05]" href="/community/moderation">Modération</Link>}
                <Link className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#D6E1EF] hover:bg-white/[.05]" href="/member/skills">Mes skills</Link>
                <Link className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#D6E1EF] hover:bg-white/[.05]" href="/account">Mon compte</Link>
                <Link className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#D6E1EF] hover:bg-white/[.05]" href="/community#suggestion">Faire une suggestion</Link>
              </nav>
            </details>
          </div>
        </div>
      </header>
      <CommunitySectionNav />
      {children}
      </div>
    </div>
  );
}
