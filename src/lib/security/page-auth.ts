import "server-only";

import { forbidden, redirect } from "next/navigation";
import { getSupabaseSessionClient } from "@/lib/supabase/browser-server";
export async function requirePageUser(nextPath: string) {
  const supabase = await getSupabaseSessionClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error && error.message !== "Auth session missing!") {
    console.error("Could not verify page session:", error.message);
  }
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  return user;
}

export async function requireAdminPage(nextPath: string) {
  const user = await requirePageUser(nextPath);
  const supabase = await getSupabaseSessionClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Could not verify page role:", error.message);
    throw new Error("Impossible de vérifier vos droits.");
  }
  if (profile?.role !== "admin") forbidden();

  return user;
}
