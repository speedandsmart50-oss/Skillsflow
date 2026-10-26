import { NextResponse } from "next/server";
import { getCommunitySession, isSameOriginRequest, isValidUuid } from "@/lib/community/server";

export async function GET() {
  const context = await getCommunitySession();
  if (!context) return NextResponse.json({ error: "Connectez-vous pour consulter vos notifications." }, { status: 401 });

  const [{ data: profile, error: profileError }, { data: rules, error: rulesError }] = await Promise.all([
    context.supabase.from("profiles").select("community_rules_version").eq("id", context.user.id).maybeSingle(),
    context.supabase.from("community_rules").select("version").eq("is_active", true).maybeSingle(),
  ]);
  if (profileError || rulesError || !profile || !rules) return NextResponse.json({ error: "Notifications momentanément indisponibles." }, { status: 503 });
  if (profile.community_rules_version !== rules.version) return NextResponse.json({ error: "Acceptez d’abord les règles de la communauté." }, { status: 428 });

  const [{ data, error }, { count, error: countError }] = await Promise.all([
    context.supabase.from("community_notifications")
      .select("id, kind, actor_name, channel_name, channel_id, excerpt, created_at, read_at")
      .eq("user_id", context.user.id)
      .order("created_at", { ascending: false })
      .limit(25),
    context.supabase.from("community_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.user.id)
      .is("read_at", null),
  ]);
  if (error || countError) {
    console.error("Could not load community notifications:", error?.message ?? countError?.message);
    return NextResponse.json({ error: "Impossible de charger les notifications." }, { status: 503 });
  }
  return NextResponse.json({ notifications: data ?? [], unreadCount: count ?? 0 }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Requête non autorisée." }, { status: 403 });
  const context = await getCommunitySession();
  if (!context) return NextResponse.json({ error: "Connectez-vous pour modifier vos notifications." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Données invalides." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  const id = (body as { id?: unknown }).id;
  if (id !== undefined && !isValidUuid(id)) return NextResponse.json({ error: "Notification invalide." }, { status: 400 });

  let query = context.supabase.from("community_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", context.user.id)
    .is("read_at", null);
  if (typeof id === "string") query = query.eq("id", id);
  const { error } = await query;
  if (error) {
    console.error("Could not mark community notifications as read:", error.message);
    return NextResponse.json({ error: "Impossible de mettre à jour les notifications." }, { status: 503 });
  }
  return NextResponse.json({ updated: true });
}
