import { connection } from "next/server";
import { MyCommunities } from "@/components/community/my-communities";
import { requirePageUser } from "@/lib/security/page-auth";
import { getSupabaseSessionClient } from "@/lib/supabase/browser-server";
import { redirect } from "next/navigation";

export const instant = false;

export default async function MyCommunitiesPage() {
  await connection();
  const user = await requirePageUser("/community/my");
  const supabase = await getSupabaseSessionClient();
  const { data: subscription } = await supabase.from("member_subscriptions").select("id").eq("user_id", user.id).eq("status", "active").gt("ends_at", new Date().toISOString()).limit(1).maybeSingle();
  if (!subscription) redirect("/account");
  return <MyCommunities />;
}
