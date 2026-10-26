"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/community", label: "Salons" },
  { href: "/community/my", label: "Ma communauté" },
  { href: "/community/private-messages", label: "Messages privés" },
];

export function CommunitySectionNav() {
  const pathname = usePathname();
  return <nav aria-label="Navigation communauté" className="mb-7 flex gap-2 overflow-x-auto border-b border-[#203650] pb-3 [scrollbar-width:thin]">
    {links.map((link) => {
      const active = link.href === "/community" ? pathname === link.href || pathname.startsWith("/community/channels") : pathname === link.href || pathname.startsWith(`${link.href}/`);
      return <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined} className={`inline-flex min-h-11 shrink-0 items-center rounded-xl px-4 text-sm font-semibold transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#70E9F5] ${active ? "bg-[#20DDF2] text-[#06131F] shadow-[0_6px_20px_rgba(32,221,242,.14)]" : "border border-[#203650] bg-[#0B1729] text-[#C5D3E2] hover:-translate-y-0.5 hover:border-[#20DDF2]/45 hover:text-white"}`}>
        {link.label}
      </Link>;
    })}
  </nav>;
}
