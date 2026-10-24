import { NextResponse } from "next/server";
import { recordAdminAction, requireAdminApiUser } from "@/lib/security/admin-api";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request: Request) {
  const access = await requireAdminApiUser(request);
  if (!access.ok) return access.response;

  const [profilesResult, auditResult] = await Promise.all([
    access.supabase
      .from("profiles")
      .select("id, email, role, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    access.supabase
      .from("audit_log")
      .select("id, actor_user_id, action, target_type, target_id, details, created_at")
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  const error = profilesResult.error ?? auditResult.error;
  if (error) {
    console.error("Could not load admin settings:", error.message);
    return NextResponse.json({ error: "Impossible de charger les paramètres." }, { status: 500 });
  }

  const actorIds = [...new Set((auditResult.data ?? []).map((entry) => entry.actor_user_id))];
  const { data: actors, error: actorError } = actorIds.length
    ? await access.supabase.from("profiles").select("id, email").in("id", actorIds)
    : { data: [], error: null };
  if (actorError) {
    console.error("Could not load audit actors:", actorError.message);
    return NextResponse.json({ error: "Impossible de charger les auteurs du journal." }, { status: 500 });
  }

  const emailsById = new Map((actors ?? []).map((actor) => [actor.id, actor.email]));
  return NextResponse.json({
    profiles: profilesResult.data ?? [],
    audit: (auditResult.data ?? []).map((entry) => ({
      ...entry,
      actorEmail: emailsById.get(entry.actor_user_id) ?? "Compte supprimé",
    })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const access = await requireAdminApiUser(request);
  if (!access.ok) return access.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "La demande est invalide." }, { status: 400 });
  }
  if (
    !isRecord(body)
    || typeof body.userId !== "string"
    || !UUID_PATTERN.test(body.userId)
    || !["client", "admin"].includes(String(body.role))
    || body.confirmation !== "CHANGER LE RÔLE"
  ) {
    return NextResponse.json({ error: "Sélectionnez un rôle valide et confirmez le changement." }, { status: 400 });
  }
  if (body.userId === access.user.id) {
    return NextResponse.json({ error: "Vous ne pouvez pas modifier votre propre rôle." }, { status: 409 });
  }

  const { data: target, error: targetError } = await access.supabase
    .from("profiles")
    .select("id, email, role")
    .eq("id", body.userId)
    .maybeSingle();
  if (targetError) {
    console.error("Could not load profile for role update:", targetError.message);
    return NextResponse.json({ error: "Impossible de vérifier ce compte." }, { status: 500 });
  }
  if (!target) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
  if (target.role === body.role) return NextResponse.json({ error: "Ce compte possède déjà ce rôle." }, { status: 409 });

  try {
    await recordAdminAction(access.supabase, access.user.id, "profile.role.update", "profile", target.id, "requested", {
      email: target.email,
      previousRole: target.role,
      nextRole: body.role,
    });
  } catch (caught) {
    return NextResponse.json({ error: caught instanceof Error ? caught.message : "Impossible d’enregistrer cette action." }, { status: 500 });
  }

  const { error } = await access.supabase.rpc("admin_set_profile_role", {
    p_admin_user_id: access.user.id,
    p_target_user_id: target.id,
    p_role: body.role,
  });
  if (error) {
    console.error("Could not change profile role:", error.message);
    const lastAdmin = error.message.includes("last administrator");
    return NextResponse.json({
      error: lastAdmin
        ? "Le dernier compte administrateur ne peut pas être rétrogradé."
        : "Impossible de modifier le rôle de ce compte.",
    }, { status: lastAdmin ? 409 : 500 });
  }

  try {
    await recordAdminAction(access.supabase, access.user.id, "profile.role.update", "profile", target.id, "completed", {
      email: target.email,
      previousRole: target.role,
      nextRole: body.role,
    });
  } catch (caught) {
    return NextResponse.json({ error: caught instanceof Error ? caught.message : "Le journal d’audit n’a pas pu confirmer l’action." }, { status: 500 });
  }
  return NextResponse.json({ profile: { id: target.id, email: target.email, role: body.role } }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
