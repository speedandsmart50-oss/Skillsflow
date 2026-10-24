import { NextResponse } from "next/server";
import { getAuthenticatedUser, getSupabaseAdminClient } from "@/lib/supabase/server";

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
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Could not verify account deletion role:", profileError.message);
    return NextResponse.json({ error: "Impossible de vérifier les droits de votre compte." }, { status: 500 });
  }
  if (profile?.role === "admin") {
    return NextResponse.json({ error: "Un compte administrateur ne peut pas être supprimé depuis cet espace." }, { status: 403 });
  }

  const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("Could not delete account:", deleteError.message);
    return NextResponse.json({ error: "La suppression du compte a échoué. Réessayez plus tard." }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
