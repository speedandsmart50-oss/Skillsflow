import { NextResponse } from "next/server";
import { getCommunitySession } from "@/lib/community/server";

type CommunityChannel = {
  id: string;
  slug: string;
  name: string;
  description: string;
  required_tier: number;
  position: number;
  accessible: boolean;
};

export async function GET() {
  const context = await getCommunitySession();
  if (!context) return NextResponse.json({ error: "Connectez-vous pour accéder à la communauté." }, { status: 401 });

  const { data: profile, error: profileError } = await context.supabase
    .from("profiles")
    .select("community_rules_version")
    .eq("id", context.user.id)
    .maybeSingle();
  const { data: activeRules, error: rulesError } = await context.supabase
    .from("community_rules")
    .select("version, body")
    .eq("is_active", true)
    .maybeSingle();
  if (profileError || rulesError || !profile || !activeRules) {
    console.error("Could not load community access state:", profileError?.message ?? rulesError?.message ?? "Missing profile or rules");
    return NextResponse.json({ error: "L’espace communauté est momentanément indisponible." }, { status: 503 });
  }
  if (profile.community_rules_version !== activeRules.version) {
    return NextResponse.json({ rules: activeRules }, { status: 428 });
  }

  const { data: channels, error } = await context.supabase.rpc("community_list_channels");
  if (error) {
    console.error("Could not load community channels:", error.message);
    return NextResponse.json({ error: "Impossible de charger les salons." }, { status: 503 });
  }
  const channelRows = (channels ?? []) as CommunityChannel[];
  const accessibleChannels = channelRows.filter((channel) => channel.accessible);
  const channelIds = accessibleChannels.map((channel) => channel.id);
  const { data: reads } = channelIds.length
    ? await context.supabase.from("channel_reads").select("channel_id, last_read_at").eq("user_id", context.user.id).in("channel_id", channelIds)
    : { data: [] };
  const lastReadByChannel = new Map((reads ?? []).map((read) => [read.channel_id, read.last_read_at]));
  const unreadByChannel = await Promise.all(accessibleChannels.map(async (channel) => {
    let query = context.supabase.from("messages").select("id", { count: "exact", head: true }).eq("channel_id", channel.id).is("deleted_at", null);
    const lastReadAt = lastReadByChannel.get(channel.id);
    if (lastReadAt) query = query.gt("created_at", lastReadAt);
    const { count } = await query;
    return [channel.id, count ?? 0] as const;
  }));
  const unreadCounts = new Map(unreadByChannel);
  const result = channelRows.map((channel) => ({ ...channel, unread_count: unreadCounts.get(channel.id) ?? 0 }));

  return NextResponse.json({ channels: result }, { headers: { "Cache-Control": "private, no-store" } });
}
