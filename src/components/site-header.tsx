import Link from "next/link";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/shop" },
  { label: "Checkout", href: "/checkout" },
  { label: "Customer area", href: "/account" },
  { label: "Admin", href: "/admin" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-cyan-400/10 bg-[#0d1321]/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3 text-lg font-semibold tracking-tight text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-300 text-sm font-black text-slate-950">S</span>
          SkillFlow
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-400 md:flex">
          {navItems.map((item) => <Link key={item.href} href={item.href} className="transition hover:text-cyan-300">{item.label}</Link>)}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="hidden rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-cyan-400/40 sm:inline-flex">Sign in</Link>
          <Link href="/shop" className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-200">Browse skills</Link>
        </div>
      </div>
    </header>
  );
}
