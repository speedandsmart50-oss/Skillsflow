import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { MemberPreferencesProvider } from "@/components/member-preferences-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <MemberPreferencesProvider>
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </MemberPreferencesProvider>
    </div>
  );
}
