import { connection } from "next/server";
import { forbidden } from "next/navigation";
import { CommunityModeration } from "@/components/community/community-moderation";
import { requirePageUser } from "@/lib/security/page-auth";
import { getSupabaseSessionClient } from "@/lib/supabase/browser-server";

export const instant = false;

export default async function CommunityModerationPage() {
  await connection();
  const user = await requirePageUser("/community/moderation");
  const supabase = await getSupabaseSessionClient();
  const [{ data: profile }, { data: staff }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("community_staff").select("staff_role").eq("user_id", user.id).maybeSingle(),
  ]);
  if (profile?.role !== "admin" && !staff) forbidden();
  return <CommunityModeration />;
}
