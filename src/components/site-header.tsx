import Link from "next/link";

const navItems = [
  { label: "Accueil", href: "/" },
  { label: "Catalogue", href: "/shop" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-cyan-400/10 bg-[#0d1321]/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3 text-[2rem] font-semibold tracking-[-0.06em] text-white">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-300 text-lg font-black text-slate-950 shadow-[0_0_20px_rgba(103,232,249,0.35)]">
            S
          </span>
          <span className="text-[1.1rem] font-bold tracking-[-0.04em] sm:text-[1.5rem]">SkillFlow</span>
        </Link>

        <nav className="hidden items-center gap-10 text-[1.05rem] font-medium text-slate-300 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition hover:text-cyan-300"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/account"
            className="rounded-full border border-cyan-300/40 bg-transparent px-5 py-2.5 text-[1.05rem] font-semibold text-cyan-100 transition hover:bg-cyan-400/10"
          >
            Mon compte
          </Link>
          <Link
            href="/shop"
            className="rounded-full bg-cyan-300 px-5 py-2.5 text-[1.05rem] font-bold text-slate-950 shadow-[0_0_24px_rgba(103,232,249,0.35)] transition hover:bg-cyan-200"
          >
            Voir le skill
          </Link>
        </div>
      </div>
    </header>
  );
}
