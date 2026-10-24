import Link from "next/link";

const navItems = [
  { label: "Accueil", href: "/" },
  { label: "Catalogue", href: "/shop" },
];

export function SiteHeader() {
  return (
    <header className="app-shell-chrome sticky top-0 z-50 border-b border-white/[0.07] bg-[#0b1020]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="SkillFlow, accueil" className="flex items-center gap-2.5 text-[2rem] font-semibold tracking-[-0.06em] text-white sm:gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-200 to-cyan-400 text-base font-black text-slate-950 shadow-[0_0_20px_rgba(103,232,249,0.3)] sm:h-10 sm:w-10 sm:text-lg">
            S
          </span>
          <span className="text-[1.05rem] font-bold tracking-[-0.04em] sm:text-[1.35rem]">SkillFlow</span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-300 lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition-colors hover:text-cyan-200 focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-full border border-white/15 bg-transparent px-3.5 py-2.5 text-xs font-semibold text-slate-200 transition hover:border-cyan-200/40 hover:bg-white/[0.04] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 sm:px-5 sm:text-sm"
          >
            Connexion
          </Link>
          <Link
            href="/account"
            className="rounded-full bg-cyan-300 px-3.5 py-2.5 text-xs font-bold text-slate-950 shadow-[0_0_24px_rgba(103,232,249,0.25)] transition hover:-translate-y-0.5 hover:bg-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100 sm:px-5 sm:text-sm"
          >
            Mes skills
          </Link>
        </div>
      </div>
    </header>
  );
}
