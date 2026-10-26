import Link, { type LinkProps } from "next/link";
import type { ReactNode } from "react";

type BackLinkProps = {
  href: LinkProps["href"];
  children: ReactNode;
  className?: string;
};

export function BackLink({ href, children, className = "" }: BackLinkProps) {
  return (
    <Link
      href={href}
      className={`group inline-flex min-h-12 w-fit shrink-0 items-center justify-center gap-3 rounded-xl border border-cyan-300/30 bg-gradient-to-r from-cyan-300 to-cyan-200 px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_8px_22px_rgba(34,211,238,.16)] transition duration-200 hover:-translate-y-0.5 hover:border-cyan-100 hover:from-cyan-200 hover:to-cyan-100 hover:shadow-[0_12px_30px_rgba(34,211,238,.25)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200 active:translate-y-0 motion-reduce:transform-none ${className}`}
    >
      <span aria-hidden="true" className="text-lg transition-transform duration-200 group-hover:-translate-x-1 motion-reduce:transform-none">←</span>
      <span>{children}</span>
    </Link>
  );
}
