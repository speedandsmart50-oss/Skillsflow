import { Suspense } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { MemberPreferencesProvider } from "@/components/member-preferences-provider";
import { AuthSessionProvider } from "@/components/auth-session-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <AuthSessionProvider>
        <MemberPreferencesProvider>
          <Suspense fallback={<div aria-hidden="true" className="h-[72px] border-b border-[#203650]/75 bg-[#07111F]/95" />}>
            <SiteHeader />
          </Suspense>
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </MemberPreferencesProvider>
      </AuthSessionProvider>
    </div>
  );
}
