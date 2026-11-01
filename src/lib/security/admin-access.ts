import "server-only";

import type { User } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { isConfiguredAdminEmail } from "@/lib/security/access";

export function isConfiguredAdmin(user: Pick<User, "email">) {
  return isConfiguredAdminEmail(user.email, process.env.SKILLFLOW_ADMIN_EMAIL);
}

export async function isAdminUserId(userId: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    console.error("Could not verify MCP administrator profile:", profileError.message);
    throw new Error("Impossible de vérifier les droits administrateur.");
  }
  if (profile?.role === "admin") return true;

  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error) {
    console.error("Could not verify MCP administrator email:", error.message);
    throw new Error("Impossible de vérifier les droits administrateur.");
  }
  return isConfiguredAdmin(data.user);
}
