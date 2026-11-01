import "server-only";

import type { User } from "@supabase/supabase-js";
import { getSupabaseSessionClient } from "@/lib/supabase/browser-server";
import { canAccessPaidFeature } from "@/lib/security/access";
import { isConfiguredAdmin } from "@/lib/security/admin-access";

type SessionSupabase = Awaited<ReturnType<typeof getSupabaseSessionClient>>;

export async function hasPaidMemberAccess(
  supabase: SessionSupabase,
  user: Pick<User, "id" | "email">,
): Promise<boolean> {
  if (isConfiguredAdmin(user)) return true;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    console.error("Could not verify paid member profile:", profileError.message);
    throw new Error("Impossible de vérifier vos droits.");
  }
  if (profile?.role === "admin") return true;

  const { data: subscription, error: subscriptionError } = await supabase
    .from("member_subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .gt("ends_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (subscriptionError) {
    console.error("Could not verify paid member subscription:", subscriptionError.message);
    throw new Error("Impossible de vérifier votre abonnement.");
  }

  return canAccessPaidFeature(profile?.role, false, Boolean(subscription));
}
