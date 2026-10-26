import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCommunitySession, hasDisallowedMessageContent, isSameOriginRequest, isValidCommunitySearchQuery, isValidUuid } from "@/lib/community/server";

type RouteContext = { params: Promise<{ channelId: string }> };

async function rulesAccepted(supabase: SupabaseClient, userId: string) {
  const [{ data: profile }, { data: rules }] = await Promise.all([
    supabase.from("profiles").select("community_rules_version").eq("id", userId).maybeSingle(),
    supabase.from("community_rules").select("version, body").eq("is_active", true).maybeSingle(),
  ]);
  return { accepted: Boolean(profile && rules && profile.community_rules_version === rules.version), rules };
}

export async function GET(request: Request, { params }: RouteContext) {
  const context = await getCommunitySession();
  if (!context) return NextResponse.json({ error: "Connectez-vous pour accéder à ce salon." }, { status: 401 });
  const { channelId } = await params;
  if (!isValidUuid(channelId)) return NextResponse.json({ error: "Salon introuvable." }, { status: 404 });
  const access = await rulesAccepted(context.supabase, context.user.id);
  if (!access.accepted) return NextResponse.json({ rules: access.rules }, { status: 428 });

  const url = new URL(request.url);
  const before = url.searchParams.get("before");
  const rawSearch = url.searchParams.get("q");
  const search = rawSearch?.trim() ?? "";
  if (before && !Number.isFinite(Date.parse(before))) return NextResponse.json({ error: "Curseur invalide." }, { status: 400 });
  if (search && !isValidCommunitySearchQuery(search)) return NextResponse.json({ error: "La recherche doit contenir entre 2 et 100 caractères." }, { status: 400 });
  let query = context.supabase
    .from("messages")
    .select("id, channel_id, author_id, content, parent_id, pinned_at, deleted_at, created_at, updated_at, community_members(display_name), reactions(id, user_id, emoji)")
    .eq("channel_id", channelId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (before) query = query.lt("created_at", before);
  if (search) query = query.textSearch("search_vector", search, { type: "websearch", config: "simple" });
  const { data, error } = await query;
  if (error) {
    console.error("Could not load community messages:", error.message);
    return NextResponse.json({ error: "Ce salon est inaccessible ou momentanément indisponible." }, { status: 404 });
  }
  if (!before) {
    const { error: readError } = await context.supabase.from("channel_reads").upsert({ user_id: context.user.id, channel_id: channelId, last_read_at: new Date().toISOString() });
    if (readError) console.error("Could not update community read marker:", readError.message);
  }
  return NextResponse.json({ messages: (data ?? []).reverse() }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request, { params }: RouteContext) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Requête non autorisée." }, { status: 403 });
  const context = await getCommunitySession();
  if (!context) return NextResponse.json({ error: "Connectez-vous pour écrire dans ce salon." }, { status: 401 });
  const { channelId } = await params;
  if (!isValidUuid(channelId)) return NextResponse.json({ error: "Salon introuvable." }, { status: 404 });
  const access = await rulesAccepted(context.supabase, context.user.id);
  if (!access.accepted) return NextResponse.json({ rules: access.rules }, { status: 428 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Données invalides." }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  const { content, parentId } = body as { content?: unknown; parentId?: unknown };
  if (typeof content !== "string" || content.trim().length < 1 || content.trim().length > 4000) {
    return NextResponse.json({ error: "Le message doit contenir entre 1 et 4 000 caractères." }, { status: 400 });
  }
  if (parentId !== undefined && parentId !== null && !isValidUuid(parentId)) return NextResponse.json({ error: "Réponse invalide." }, { status: 400 });
  if (hasDisallowedMessageContent(content)) {
    return NextResponse.json({ error: "Ce message contient une promesse de gain ou une fausse urgence. Reformulez-le de manière honnête." }, { status: 422 });
  }
  const { data, error } = await context.supabase
    .from("messages")
    .insert({ channel_id: channelId, author_id: context.user.id, content: content.trim(), parent_id: parentId ?? null })
    .select("id, channel_id, author_id, content, parent_id, pinned_at, deleted_at, created_at, updated_at, community_members(display_name), reactions(id, user_id, emoji)")
    .single();
  if (error) {
    const tooFast = /quelques secondes|déjà été envoyé/i.test(error.message);
    return NextResponse.json({ error: tooFast ? error.message : "Impossible d’envoyer le message dans ce salon." }, { status: tooFast ? 429 : 403 });
  }
  return NextResponse.json({ message: data }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
