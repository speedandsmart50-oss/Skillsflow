import { NextResponse } from "next/server";
import { getCommunitySession, isSameOriginRequest, isValidUuid } from "@/lib/community/server";

export async function GET(request: Request) {
  const context = await getCommunitySession();
  if (!context) return NextResponse.json({ error: "Connectez-vous pour accéder aux messages." }, { status: 401 });
  const { data: memberships, error: membershipsError } = await context.supabase.from("member_community_memberships").select("community_id").eq("user_id", context.user.id);
  if (membershipsError) return NextResponse.json({ error: "Impossible de charger les membres." }, { status: 503 });
  const communityIds = (memberships ?? []).map((row) => row.community_id);
  const { data: peers } = communityIds.length ? await context.supabase.from("member_community_memberships").select("user_id, display_name, community_id").in("community_id", communityIds).neq("user_id", context.user.id) : { data: [] };
  const uniquePeers = [...new Map((peers ?? []).map((peer) => [peer.user_id, peer])).values()];
  const { data: threads, error } = await context.supabase.from("member_direct_threads").select("id, user_one, user_two, created_at").or(`user_one.eq.${context.user.id},user_two.eq.${context.user.id}`).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Impossible de charger les conversations." }, { status: 503 });
  const selectedId = new URL(request.url).searchParams.get("thread");
  if (selectedId && !isValidUuid(selectedId)) return NextResponse.json({ error: "Conversation introuvable." }, { status: 404 });
  let messages: unknown[] = [];
  if (selectedId && threads?.some((thread) => thread.id === selectedId)) {
    const { data } = await context.supabase.from("member_direct_messages").select("id, author_id, content, created_at").eq("thread_id", selectedId).order("created_at", { ascending: true }).limit(100);
    messages = data ?? [];
  }
  return NextResponse.json({ peers: uniquePeers, threads: threads ?? [], messages }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Requête non autorisée." }, { status: 403 });
  const context = await getCommunitySession();
  if (!context) return NextResponse.json({ error: "Connectez-vous pour continuer." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Données invalides." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  const input = body as { action?: unknown; peerId?: unknown; threadId?: unknown; content?: unknown };
  if (input.action === "start") {
    if (!isValidUuid(input.peerId)) return NextResponse.json({ error: "Membre invalide." }, { status: 400 });
    const { data, error } = await context.supabase.rpc("open_member_direct_thread", { p_peer_user_id: input.peerId });
    if (error) return NextResponse.json({ error: "Vous devez partager une communauté pour contacter ce membre." }, { status: 403 });
    return NextResponse.json({ threadId: data }, { status: 201 });
  }
  if (input.action === "send") {
    if (!isValidUuid(input.threadId) || typeof input.content !== "string" || input.content.trim().length < 1 || input.content.trim().length > 4000) return NextResponse.json({ error: "Message invalide." }, { status: 400 });
    const { error } = await context.supabase.from("member_direct_messages").insert({ thread_id: input.threadId, author_id: context.user.id, content: input.content.trim() });
    return error ? NextResponse.json({ error: "Impossible d’envoyer le message. Vérifiez que cette conversation vous appartient." }, { status: 403 }) : NextResponse.json({ sent: true }, { status: 201 });
  }
  return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
}
