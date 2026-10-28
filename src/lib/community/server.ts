import "server-only";

import { getSupabaseSessionClient } from "@/lib/supabase/browser-server";
export { hasDisallowedMessageContent, isSameOriginRequest, isValidCommunitySearchQuery, isValidUuid } from "@/lib/community/policy";

export async function getCommunitySession() {
  const supabase = await getSupabaseSessionClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return { supabase, user };
}

export async function hasActiveSubscription(supabase: Awaited<ReturnType<typeof getSupabaseSessionClient>>, userId: string) {
  const { data, error } = await supabase
    .from("member_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .gt("ends_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();
  return !error && Boolean(data);
}
