import "server-only";

import { NextResponse } from "next/server";
import { getAuthenticatedUser, getSupabaseAdminClient } from "@/lib/supabase/server";

export async function requireAdminApiUser(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Connectez-vous pour accéder à l’administration." }, { status: 401 }),
    };
  }

  const supabase = getSupabaseAdminClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Could not verify admin API access:", error.message);
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Impossible de vérifier vos droits." }, { status: 500 }),
    };
  }
  if (profile?.role !== "admin") {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Accès réservé aux administrateurs." }, { status: 403 }),
    };
  }

  return { ok: true as const, user, supabase };
}

export async function recordAdminAction(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  actorUserId: string,
  action: string,
  targetType: string,
  targetId: string | null,
  phase: "requested" | "completed",
  details: Record<string, unknown> = {},
) {
  const { error } = await supabase.from("audit_log").insert({
    actor_user_id: actorUserId,
    action,
    target_type: targetType,
    target_id: targetId,
    details: { ...details, phase },
  });

  if (error) {
    console.error("Could not record admin action:", error.message);
    throw new Error("L’action n’a pas pu être enregistrée dans le journal d’audit.");
  }
}
