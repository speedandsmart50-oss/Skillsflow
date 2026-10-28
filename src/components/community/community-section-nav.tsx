"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/community", label: "Salons" },
  { href: "/community/my", label: "Ma communauté" },
  { href: "/community/private-messages", label: "Messages privés" },
  { href: "/member/skills", label: "Skillsflow" },
  { href: "/member/prospection", label: "Prospection" },
  { href: "/community/closing-negociation", label: "Académie" },
];

function isActive(pathname: string, href: string) {
  if (href === "/community") {
    return pathname === "/community" || pathname.startsWith("/community/channels");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function CommunitySectionNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigation de la communauté" className="mb-7 flex gap-2 overflow-x-auto border-b border-[#1E2B4C] pb-3 [scrollbar-width:thin]">
      {links.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-xl px-4 text-sm font-semibold transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#70E9F5] motion-reduce:transition-none ${
              active
                ? "bg-gradient-to-r from-[#397BFF] to-[#6557FF] text-white shadow-[0_6px_20px_rgba(57,123,255,.25)]"
                : "border border-[#1E2B4C] bg-[#151F38]/70 text-[#A5B4CB] hover:-translate-y-0.5 hover:border-[#397BFF]/40 hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
