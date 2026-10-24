"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showLayout = pathname !== "/login";

  return (
    <div className="flex min-h-screen flex-col">
      {showLayout && <SiteHeader />}
      <div className="flex-1">{children}</div>
      {showLayout && <SiteFooter />}
    </div>
  );
}
