import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getCommunitySession, isSameOriginRequest } from "@/lib/community/server";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Requête non autorisée." }, { status: 403 });
  const context = await getCommunitySession();
  if (!context) return NextResponse.json({ error: "Connectez-vous pour envoyer une suggestion." }, { status: 401 });

  const [{ data: profile, error: profileError }, { data: activeRules, error: rulesError }] = await Promise.all([
    context.supabase.from("profiles").select("community_rules_version").eq("id", context.user.id).maybeSingle(),
    context.supabase.from("community_rules").select("version").eq("is_active", true).maybeSingle(),
  ]);
  if (profileError || rulesError || !profile || !activeRules) {
    console.error("Could not verify community membership for suggestion:", profileError?.message ?? rulesError?.message ?? "Missing profile or rules");
    return NextResponse.json({ error: "Impossible de vérifier votre accès à la communauté." }, { status: 503 });
  }
  if (profile.community_rules_version !== activeRules.version) {
    return NextResponse.json({ error: "Acceptez d’abord les règles de la communauté." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Le formulaire est incomplet." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Le formulaire est invalide." }, { status: 400 });
  const { subject, message } = body as { subject?: unknown; message?: unknown };
  if (typeof subject !== "string" || subject.trim().length < 3 || subject.trim().length > 160
    || typeof message !== "string" || message.trim().length < 10 || message.trim().length > 5000) {
    return NextResponse.json({ error: "Vérifiez le sujet et le contenu de votre suggestion." }, { status: 400 });
  }

  const { error } = await getSupabaseAdminClient().from("support_tickets").insert({
    user_id: context.user.id,
    category: "suggestion",
    subject: subject.trim(),
    message: message.trim(),
  });
  if (error) {
    console.error("Could not save community suggestion:", error.message);
    return NextResponse.json({ error: "Impossible d’enregistrer votre suggestion pour le moment." }, { status: 500 });
  }
  return NextResponse.json({ submitted: true }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
