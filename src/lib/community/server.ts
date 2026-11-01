import "server-only";

import { getSupabaseSessionClient } from "@/lib/supabase/browser-server";
export { hasDisallowedMessageContent, isSameOriginRequest, isValidCommunitySearchQuery, isValidUuid } from "@/lib/community/policy";

export async function getCommunitySession() {
  const supabase = await getSupabaseSessionClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return { supabase, user };
}
