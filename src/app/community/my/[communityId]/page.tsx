import { connection } from "next/server";
import { MemberCommunityWorkspace } from "@/components/community/member-community-workspace";
import { requirePageUser } from "@/lib/security/page-auth";
import { getSupabaseSessionClient } from "@/lib/supabase/browser-server";
import { redirect } from "next/navigation";

export const instant = false;

export default async function MemberCommunityPage({ params }: { params: Promise<{ communityId: string }> }) {
  await connection();
  const { communityId } = await params;
  const user = await requirePageUser(`/community/my/${communityId}`);
  const supabase = await getSupabaseSessionClient();
  const { data: subscription } = await supabase.from("member_subscriptions").select("id").eq("user_id", user.id).eq("status", "active").gt("ends_at", new Date().toISOString()).limit(1).maybeSingle();
  if (!subscription) redirect("/account");
  return <MemberCommunityWorkspace communityId={communityId} userId={user.id} />;
}
