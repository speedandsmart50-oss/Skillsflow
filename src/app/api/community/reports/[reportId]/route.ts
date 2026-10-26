import { NextResponse } from "next/server";
import { getCommunitySession, isSameOriginRequest, isValidUuid } from "@/lib/community/server";

type RouteContext = { params: Promise<{ reportId: string }> };

async function isStaff(context: NonNullable<Awaited<ReturnType<typeof getCommunitySession>>>) {
  const [{ data: profile }, { data: role }] = await Promise.all([
    context.supabase.from("profiles").select("role").eq("id", context.user.id).maybeSingle(),
    context.supabase.from("community_staff").select("staff_role").eq("user_id", context.user.id).maybeSingle(),
  ]);
  return profile?.role === "admin" || Boolean(role);
}

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Requête non autorisée." }, { status: 403 });
  const context = await getCommunitySession();
  if (!context) return NextResponse.json({ error: "Connectez-vous pour traiter ce signalement." }, { status: 401 });
  if (!await isStaff(context)) return NextResponse.json({ error: "Cette action est réservée à l’équipe." }, { status: 403 });

  const { reportId } = await params;
  if (!isValidUuid(reportId)) return NextResponse.json({ error: "Signalement introuvable." }, { status: 404 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Données invalides." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  const { action } = body as { action?: unknown };
  if (action !== "dismiss" && action !== "remove_message") return NextResponse.json({ error: "Action invalide." }, { status: 400 });

  if (action === "remove_message") {
    const { data: report, error: reportError } = await context.supabase.from("reports")
      .select("message_id")
      .eq("id", reportId)
      .eq("status", "open")
      .maybeSingle();
    if (reportError || !report) return NextResponse.json({ error: "Ce signalement n’est plus disponible." }, { status: 404 });
    const { data: message, error: messageError } = await context.supabase.from("messages")
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", report.message_id)
      .select("id")
      .maybeSingle();
    if (messageError || !message) return NextResponse.json({ error: "Impossible de retirer le message." }, { status: 503 });
  }

  const { error } = await context.supabase.from("reports")
    .update({ status: action === "dismiss" ? "dismissed" : "reviewed" })
    .eq("id", reportId)
    .eq("status", "open");
  if (error) {
    console.error("Could not update community report:", error.message);
    return NextResponse.json({ error: "Impossible de mettre à jour le signalement." }, { status: 503 });
  }
  return NextResponse.json({ updated: true });
}
