"use client";

import Link from "next/link";
import { SiteHeaderNavigation } from "@/components/site-header-navigation";
import { useAuthSession } from "@/components/auth-session-provider";
import { ElectricLogo } from "@/components/electric-icons";

export function SiteHeader() {
  const { status } = useAuthSession();

  return (
    <header className="app-shell-chrome sticky top-0 z-50 border-b border-[#203650]/75 bg-[#07111F]/95 backdrop-blur-xl">
      <div className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Skillsflow, accueil" className="site-logo flex shrink-0 items-center text-white">
          <ElectricLogo />
        </Link>
        <SiteHeaderNavigation authStatus={status} />
      </div>
    </header>
  );
}
