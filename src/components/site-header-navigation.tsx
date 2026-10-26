"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navItems = [
  { label: "Accueil", href: "/" },
  { label: "Catalogue", href: "/shop" },
  { label: "Communauté", href: "/community" },
  { label: "Académies", href: "/community/closing-negociation" },
];

function isCurrentPage(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/community") return pathname === "/community" || (pathname.startsWith("/community/") && !pathname.startsWith("/community/closing-negociation"));
  return pathname === href || pathname.startsWith(`${href}/`) || (href === "/shop" && pathname.startsWith("/products/"));
}

const actionLink = "inline-flex min-h-11 items-center justify-center rounded-full border border-[#203650] px-5 text-sm font-semibold text-[#D6E1EF] transition duration-200 hover:border-[#20DDF2]/55 hover:bg-[#20DDF2]/[.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#70E9F5]";

export function SiteHeaderNavigation() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return <>
    <nav aria-label="Navigation principale" className="hidden items-center gap-1 lg:flex">
      {navItems.map((item) => {
        const active = isCurrentPage(pathname, item.href);
        return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`relative inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#70E9F5] ${active ? "text-[#70E9F5]" : "text-[#A8B7CB] hover:bg-white/[.04] hover:text-white"}`}>
          {item.label}
          {active && <span aria-hidden="true" className="absolute inset-x-4 bottom-1 h-0.5 rounded-full bg-[#20DDF2]" />}
        </Link>;
      })}
    </nav>

    <div className="hidden shrink-0 items-center gap-2.5 lg:flex">
      <Link href="/login" className={actionLink}>Connexion</Link>
      <Link href="/login?mode=signup" className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#20DDF2]/50 px-5 text-sm font-semibold text-[#70E9F5] transition duration-200 hover:-translate-y-0.5 hover:border-[#20DDF2] hover:bg-[#20DDF2]/[.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#70E9F5]">Inscription</Link>
      <Link href="/account" className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#20DDF2] px-5 text-sm font-bold text-[#06131F] transition duration-200 hover:-translate-y-0.5 hover:bg-[#70E9F5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#70E9F5]">Mes skills</Link>
    </div>

    <button type="button" aria-expanded={menuOpen} aria-controls="mobile-site-menu" onClick={() => setMenuOpen((open) => !open)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#203650] px-3.5 text-sm font-semibold text-[#EAF2FA] transition hover:border-[#20DDF2]/55 hover:bg-[#20DDF2]/[.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#70E9F5] lg:hidden">
      <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center">
        {menuOpen ? <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" /></svg> : <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" /></svg>}
      </span>
      <span>{menuOpen ? "Fermer" : "Menu"}</span>
    </button>

    {menuOpen && <nav id="mobile-site-menu" aria-label="Navigation mobile" className="absolute inset-x-0 top-full border-t border-[#203650]/75 bg-[#0B1729] px-4 pb-5 pt-3 shadow-xl sm:px-6 lg:hidden">
      <div className="mx-auto grid max-w-7xl gap-1">
        {navItems.map((item) => {
          const active = isCurrentPage(pathname, item.href);
          return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} onClick={() => setMenuOpen(false)} className={`flex min-h-12 items-center justify-between rounded-xl px-4 text-base font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#70E9F5] ${active ? "bg-[#20DDF2]/10 text-[#70E9F5]" : "text-[#C2CEDD] hover:bg-white/[.04] hover:text-white"}`}>
            {item.label}{active && <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#20DDF2]" />}
          </Link>;
        })}
        <div className="mt-2 grid grid-cols-2 gap-2 border-t border-[#203650]/75 pt-3">
          <Link href="/login" onClick={() => setMenuOpen(false)} className={`${actionLink} w-full`}>Connexion</Link>
          <Link href="/login?mode=signup" onClick={() => setMenuOpen(false)} className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#20DDF2]/50 px-4 text-sm font-semibold text-[#70E9F5] transition hover:border-[#20DDF2] hover:bg-[#20DDF2]/[.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#70E9F5]">Inscription</Link>
          <Link href="/account" onClick={() => setMenuOpen(false)} className="col-span-2 inline-flex min-h-11 items-center justify-center rounded-full bg-[#20DDF2] px-4 text-sm font-bold text-[#06131F] transition hover:bg-[#70E9F5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#70E9F5]">Mes skills</Link>
        </div>
      </div>
    </nav>}
  </>;
}
