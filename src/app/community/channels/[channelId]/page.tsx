import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { ChannelChat } from "@/components/community/channel-chat";
import { requirePageUser } from "@/lib/security/page-auth";
import { getSupabaseSessionClient } from "@/lib/supabase/browser-server";

export const instant = false;

export default async function CommunityChannelPage({ params }: { params: Promise<{ channelId: string }> }) {
  await connection();
  const { channelId } = await params;
  const user = await requirePageUser(`/community/channels/${encodeURIComponent(channelId)}`);
  const supabase = await getSupabaseSessionClient();
  const [{ data: profile }, { data: channel }, { data: staffRole }] = await Promise.all([
    supabase.from("profiles").select("community_rules_version, role").eq("id", user.id).maybeSingle(),
    supabase.from("channels").select("id, name, description").eq("id", channelId).eq("is_active", true).maybeSingle(),
    supabase.from("community_staff").select("staff_role").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!channel) notFound();
  if (!profile?.community_rules_version) redirect("/community");
  return <ChannelChat channelId={channel.id} channelName={channel.name} description={channel.description} userId={user.id} isStaff={profile.role === "admin" || Boolean(staffRole)} />;
}
