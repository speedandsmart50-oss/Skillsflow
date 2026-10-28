import { NextResponse } from "next/server";
import { getAuthenticatedUser, getSupabaseAdminClient } from "@/lib/supabase/server";

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Connectez-vous pour gérer vos skills inclus." }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  const { data: subscription, error: subscriptionError } = await supabase
    .from("member_subscriptions")
    .select("id, plan_slug, ends_at")
    .eq("user_id", user.id)
    .eq("status", "active")
    .gt("ends_at", new Date().toISOString())
    .order("ends_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subscriptionError) {
    console.error("Could not load subscription skill selection:", subscriptionError.message);
    return NextResponse.json({ error: "Impossible de charger vos skills inclus." }, { status: 503 });
  }
  if (!subscription) return NextResponse.json({ subscription: null, skills: [] }, { headers: { "Cache-Control": "private, no-store" } });

  const [{ data: selection, error: selectionError }, { data: skills, error: skillsError }] = await Promise.all([
    supabase.from("member_subscription_skills").select("skill_id").eq("subscription_id", subscription.id),
    supabase.from("skills").select("id, slug, name, short_description").eq("is_active", true).order("name"),
  ]);

  if (selectionError || skillsError) {
    console.error("Could not load subscription skill choices:", selectionError?.message ?? skillsError?.message);
    return NextResponse.json({ error: "Impossible de charger la sélection des skills." }, { status: 503 });
  }

  const limit = subscription.plan_slug === "skillflow-plus" ? 1 : subscription.plan_slug === "skillflow-pro" ? 2 : 3;
  return NextResponse.json({
    subscription: { ...subscription, limit },
    selectedSkillIds: (selection ?? []).map((item) => item.skill_id),
    skills: skills ?? [],
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Connectez-vous pour enregistrer vos skills inclus." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Sélection invalide." }, { status: 400 }); }

  const skillIds = typeof body === "object" && body !== null && "skillIds" in body && Array.isArray(body.skillIds)
    ? body.skillIds
    : null;
  if (!skillIds || skillIds.length < 1 || skillIds.length > 3 || skillIds.some((id) => !isUuid(id))) {
    return NextResponse.json({ error: "Choisissez entre 1 et 3 skills valides." }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdminClient().rpc("set_member_subscription_skills", {
    p_user_id: user.id,
    p_skill_ids: [...new Set(skillIds)],
  });
  if (error) {
    const message = error.message.includes("Invalid skill selection") || error.message.includes("Skill unavailable")
      ? "Cette sélection ne correspond pas à votre abonnement."
      : "Impossible d’enregistrer votre sélection.";
    return NextResponse.json({ error: message }, { status: error.message.includes("Active subscription") ? 403 : 400 });
  }

  return NextResponse.json({ selection: data }, { headers: { "Cache-Control": "private, no-store" } });
}

