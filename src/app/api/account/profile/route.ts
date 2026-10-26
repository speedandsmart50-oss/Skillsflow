import { NextResponse } from "next/server";
import { getAuthenticatedUser, getSupabaseAdminClient } from "@/lib/supabase/server";

const allowedThemes = new Set(["midnight", "ocean", "violet", "light"]);

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Connectez-vous pour consulter votre profil." }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("profiles").select("display_name, avatar_path, dashboard_theme").eq("id", user.id).maybeSingle();
  if (error) {
    console.error("Could not load member profile preferences:", error.message);
    return NextResponse.json({ error: "Impossible de charger votre profil." }, { status: 500 });
  }
  const avatarPath = data?.avatar_path ?? null;
  const { data: signedAvatar } = avatarPath
    ? await supabase.storage.from("member-avatars").createSignedUrl(avatarPath, 3600)
    : { data: null };

  return NextResponse.json({ profile: {
    displayName: data?.display_name ?? "",
    email: user.email ?? "",
    theme: data?.dashboard_theme ?? "midnight",
    avatarUrl: signedAvatar?.signedUrl ?? null,
  } }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Connectez-vous pour modifier votre profil." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Les réglages envoyés sont invalides." }, { status: 400 }); }
  if (typeof body !== "object" || body === null || !("displayName" in body) || !("theme" in body)) {
    return NextResponse.json({ error: "Indiquez un nom de profil et un thème." }, { status: 400 });
  }
  const record = body as Record<string, unknown>;
  if (typeof record.displayName !== "string" || record.displayName.trim().length > 60) {
    return NextResponse.json({ error: "Le nom de profil doit contenir au maximum 60 caractères." }, { status: 400 });
  }
  if (typeof record.theme !== "string" || !allowedThemes.has(record.theme)) {
    return NextResponse.json({ error: "Choisissez un thème proposé." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("profiles").update({
    display_name: record.displayName.trim(),
    dashboard_theme: record.theme,
  }).eq("id", user.id);
  if (error) {
    console.error("Could not save member profile preferences:", error.message);
    return NextResponse.json({ error: "Impossible d’enregistrer vos réglages." }, { status: 500 });
  }
  return NextResponse.json({ profile: { displayName: record.displayName.trim(), theme: record.theme } }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user || !user.email) {
    return NextResponse.json({ error: "Connectez-vous pour supprimer votre compte." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Confirmez votre adresse et la suppression demandée." }, { status: 400 });
  }
  if (
    typeof body !== "object"
    || body === null
    || !("confirmation" in body)
    || body.confirmation !== "SUPPRIMER"
    || !("email" in body)
    || typeof body.email !== "string"
    || body.email.trim().toLowerCase() !== user.email.trim().toLowerCase()
  ) {
    return NextResponse.json({ error: "La confirmation ne correspond pas à votre compte." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, avatar_path")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Could not verify account deletion role:", profileError.message);
    return NextResponse.json({ error: "Impossible de vérifier les droits de votre compte." }, { status: 500 });
  }
  if (profile?.role === "admin") {
    return NextResponse.json({ error: "Un compte administrateur ne peut pas être supprimé depuis cet espace." }, { status: 403 });
  }

  if (profile?.avatar_path) {
    const { error: avatarError } = await supabase.storage.from("member-avatars").remove([profile.avatar_path]);
    if (avatarError) {
      console.error("Could not remove member avatar before account deletion:", avatarError.message);
      return NextResponse.json({ error: "Impossible de supprimer votre photo de profil pour le moment." }, { status: 500 });
    }
  }

  const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("Could not delete account:", deleteError.message);
    return NextResponse.json({ error: "La suppression du compte a échoué. Réessayez plus tard." }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
