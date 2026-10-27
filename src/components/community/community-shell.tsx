import Link from "next/link";
import { CommunityNotifications } from "@/components/community/community-notifications";
import { CommunitySectionNav } from "@/components/community/community-section-nav";
import { ElectricLogo } from "@/components/electric-icons";

const actionClass =
  "inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-[#1E2B4C] bg-[#151F38]/80 px-3.5 text-sm font-semibold text-[#A5B4CB] transition duration-200 hover:border-[#397BFF]/40 hover:bg-[#397BFF]/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#397BFF]";

export function CommunityShell({ children, userId, isStaff }: { children: React.ReactNode; userId: string; isStaff: boolean }) {
  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#0B1020] font-sans text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Header */}
        <header className="mb-7 overflow-hidden rounded-2xl border border-[#1E2B4C] bg-[#11182B] shadow-[0_12px_36px_rgba(0,0,0,.3)]">
          <div className="flex flex-col gap-4 p-5 sm:p-6 md:flex-row md:items-center md:justify-between lg:px-7">
            {/* Breadcrumb + Title */}
            <div className="flex min-w-0 items-center gap-5">
              <Link href="/" aria-label="Skillsflow, accueil" className="site-logo hidden shrink-0 sm:flex">
                <ElectricLogo />
              </Link>
              <div className="min-w-0">
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-[#397BFF]">
                <span aria-hidden="true">⌂</span>
                <span>Skillsflow</span>
                <span aria-hidden="true" className="text-[#64748B]">/</span>
                <span className="text-[#8F9CAE]">Communauté</span>
              </p>
              <h1 className="mt-1.5 text-xl font-bold tracking-[-.025em] text-white sm:text-2xl">
                Progressez avec méthode
              </h1>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Link className={actionClass} href="/account">Retour à mon espace</Link>
              <CommunityNotifications userId={userId} />
              <div className="hidden items-center gap-2 md:flex">
                {isStaff && (
                  <Link className={actionClass} href="/community/moderation">Modération</Link>
                )}
                <Link className={actionClass} href="/member/skills">Mes skills</Link>
                <Link className={actionClass} href="/account">Mon compte</Link>
              </div>
              {/* Mobile dropdown */}
              <details className="group relative md:hidden">
                <summary className={`${actionClass} list-none cursor-pointer [&::-webkit-details-marker]:hidden`}>
                  Actions <span aria-hidden="true" className="ml-2 text-xs text-[#8F9CAE] transition-transform group-open:rotate-180">⌄</span>
                </summary>
                <nav
                  aria-label="Actions de la communauté"
                  className="absolute right-0 z-30 mt-2 grid w-48 gap-0.5 rounded-xl border border-[#1E2B4C] bg-[#0D1527] p-2 shadow-2xl"
                >
                  {isStaff && (
                    <Link className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#A5B4CB] transition hover:bg-white/[.06] hover:text-white" href="/community/moderation">Modération</Link>
                  )}
                  <Link className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#A5B4CB] transition hover:bg-white/[.06] hover:text-white" href="/member/skills">Mes skills</Link>
                  <Link className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#A5B4CB] transition hover:bg-white/[.06] hover:text-white" href="/account">Mon compte</Link>
                  <Link className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#A5B4CB] transition hover:bg-white/[.06] hover:text-white" href="/community#suggestion">Faire une suggestion</Link>
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

