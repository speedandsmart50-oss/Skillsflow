import { CommunityShell } from "@/components/community/community-shell";
import { getSupabaseSessionClient } from "@/lib/supabase/browser-server";

export default async function CommunityLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <>{children}</>;
  const [{ data: profile }, { data: staff }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("community_staff").select("user_id").eq("user_id", user.id).maybeSingle(),
  ]);
  return <CommunityShell userId={user.id} isStaff={profile?.role === "admin" || Boolean(staff)}>{children}</CommunityShell>;
}
