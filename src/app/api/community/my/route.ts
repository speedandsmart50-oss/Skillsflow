import { NextResponse } from "next/server";
import { getCommunitySession, hasActiveSubscription, isSameOriginRequest } from "@/lib/community/server";

export async function GET() {
  const context = await getCommunitySession();
  if (context && !(await hasActiveSubscription(context.supabase, context.user.id))) return NextResponse.json({ error: "Un abonnement actif est requis pour Ma communauté." }, { status: 403 });
  if (!context) return NextResponse.json({ error: "Connectez-vous pour gérer vos communautés." }, { status: 401 });
  const { data: memberships, error: membershipError } = await context.supabase.from("member_community_memberships")
    .select("community_id, display_name, member_role, joined_at").eq("user_id", context.user.id).order("joined_at", { ascending: false });
  if (membershipError) return NextResponse.json({ error: "Impossible de charger vos communautés." }, { status: 503 });
  const rows = memberships ?? [];
  const ids = rows.map((row) => row.community_id);
  const { data: communities, error } = ids.length
    ? await context.supabase.from("member_communities").select("id, name, description, created_at").in("id", ids)
    : { data: [], error: null };
  if (error) return NextResponse.json({ error: "Impossible de charger vos communautés." }, { status: 503 });
  const { data: counts } = ids.length ? await context.supabase.from("member_community_memberships").select("community_id").in("community_id", ids) : { data: [] };
  return NextResponse.json({ communities: (communities ?? []).map((community) => ({
    ...community,
    myRole: rows.find((row) => row.community_id === community.id)?.member_role ?? "member",
    memberCount: (counts ?? []).filter((row) => row.community_id === community.id).length,
  })) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Requête non autorisée." }, { status: 403 });
  const context = await getCommunitySession();
  if (context && !(await hasActiveSubscription(context.supabase, context.user.id))) return NextResponse.json({ error: "Un abonnement actif est requis pour Ma communauté." }, { status: 403 });
  if (!context) return NextResponse.json({ error: "Connectez-vous pour continuer." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Données invalides." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  const payload = body as { action?: unknown; name?: unknown; description?: unknown; inviteToken?: unknown };
  if (payload.action === "create") {
    if (typeof payload.name !== "string" || payload.name.trim().length < 2 || payload.name.trim().length > 80 || typeof (payload.description ?? "") !== "string" || String(payload.description ?? "").length > 500) return NextResponse.json({ error: "Vérifiez le nom et la description." }, { status: 400 });
    const { data, error } = await context.supabase.rpc("create_member_community", { p_name: payload.name.trim(), p_description: String(payload.description ?? "").trim() });
    if (error) return NextResponse.json({ error: "La création a échoué. Vérifiez que la migration communauté est appliquée." }, { status: 503 });
    return NextResponse.json({ communityId: data }, { status: 201 });
  }
  if (payload.action === "join") {
    if (typeof payload.inviteToken !== "string" || !/^[a-f0-9]{36}$/.test(payload.inviteToken)) return NextResponse.json({ error: "Lien ou code d’invitation invalide." }, { status: 400 });
    const { data, error } = await context.supabase.rpc("join_member_community", { p_invite_token: payload.inviteToken });
    if (error) return NextResponse.json({ error: error.code === "P0002" ? "Cette invitation est introuvable." : "Impossible de rejoindre cette communauté." }, { status: error.code === "P0002" ? 404 : 503 });
    return NextResponse.json({ communityId: data }, { status: 200 });
  }
  return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
}
