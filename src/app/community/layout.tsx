import { CommunityShell } from "@/components/community/community-shell";
import { requirePageUser } from "@/lib/security/page-auth";

export default async function CommunityLayout({ children }: { children: React.ReactNode }) {
  await requirePageUser("/community");
  return <CommunityShell>{children}</CommunityShell>;
}
