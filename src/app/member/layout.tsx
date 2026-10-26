import { MemberPreferencesProvider } from "@/components/member-preferences-provider";

export default function MemberLayout({ children }: LayoutProps<"/member">) {
  return <MemberPreferencesProvider>{children}</MemberPreferencesProvider>;
}
