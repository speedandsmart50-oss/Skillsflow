import { Suspense } from "react";
import Link from "next/link";
import { SiteHeaderNavigation } from "@/components/site-header-navigation";
import { getSupabaseSessionClient } from "@/lib/supabase/browser-server";

export async function SiteHeader() {
  let isAuthenticated = false;

  try {
    const supabase = await getSupabaseSessionClient();
    const { data: { user } } = await supabase.auth.getUser();
    isAuthenticated = Boolean(user);
  } catch {
    // L’en-tête reste utilisable comme pour un visiteur si Supabase est indisponible.
  }

  return (
    <header className="app-shell-chrome sticky top-0 z-50 border-b border-[#203650]/75 bg-[#07111F]/95 backdrop-blur-xl">
      <div className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="SkillFlow, accueil" className="flex shrink-0 items-center gap-3 text-white">
          <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#70E9F5] to-[#20DDF2] text-lg font-black text-[#07111F] shadow-[0_5px_18px_rgba(32,221,242,.14)]">S</span>
          <span className="text-xl font-bold tracking-[-.045em]">SkillFlow</span>
        </Link>
        <Suspense fallback={<div aria-hidden="true" className="h-11 w-64 rounded-xl bg-white/[.025]" />}>
          <SiteHeaderNavigation isAuthenticated={isAuthenticated} />
        </Suspense>
      </div>
    </header>
  );
}
