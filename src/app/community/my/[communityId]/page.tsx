import { connection } from "next/server";
import { MemberCommunityWorkspace } from "@/components/community/member-community-workspace";
import { requirePageUser } from "@/lib/security/page-auth";
import { getSupabaseSessionClient } from "@/lib/supabase/browser-server";
import { redirect } from "next/navigation";
import { hasPaidMemberAccess } from "@/lib/security/paid-access";

export const instant = false;

export default async function MemberCommunityPage({ params }: { params: Promise<{ communityId: string }> }) {
  await connection();
  const { communityId } = await params;
  const user = await requirePageUser(`/community/my/${communityId}`);
  const supabase = await getSupabaseSessionClient();
  if (!(await hasPaidMemberAccess(supabase, user))) redirect("/account");
  return <MemberCommunityWorkspace communityId={communityId} userId={user.id} />;
}
