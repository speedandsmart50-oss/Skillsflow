import { NextResponse } from "next/server";
import { getCommunitySession, hasDisallowedMessageContent, isSameOriginRequest, isValidUuid } from "@/lib/community/server";

type RouteContext = { params: Promise<{ messageId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Requête non autorisée." }, { status: 403 });
  const context = await getCommunitySession();
  if (!context) return NextResponse.json({ error: "Connectez-vous pour modifier ce message." }, { status: 401 });
  const { messageId } = await params;
  if (!isValidUuid(messageId)) return NextResponse.json({ error: "Message introuvable." }, { status: 404 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Données invalides." }, { status: 400 }); }
  const content = body && typeof body === "object" ? (body as { content?: unknown }).content : undefined;
  if (typeof content !== "string" || content.trim().length < 1 || content.trim().length > 4000) {
    return NextResponse.json({ error: "Le message doit contenir entre 1 et 4 000 caractères." }, { status: 400 });
  }
  if (hasDisallowedMessageContent(content)) return NextResponse.json({ error: "Reformulez le message sans promesse de gain ni fausse urgence." }, { status: 422 });
  const { data, error } = await context.supabase.from("messages").update({ content: content.trim(), updated_at: new Date().toISOString() }).eq("id", messageId).eq("author_id", context.user.id).select("id").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Le message n’existe plus ou le délai de modification est dépassé." }, { status: 403 });
  return NextResponse.json({ updated: true });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Requête non autorisée." }, { status: 403 });
  const context = await getCommunitySession();
  if (!context) return NextResponse.json({ error: "Connectez-vous pour supprimer ce message." }, { status: 401 });
  const { messageId } = await params;
  if (!isValidUuid(messageId)) return NextResponse.json({ error: "Message introuvable." }, { status: 404 });
  const { data, error } = await context.supabase.from("messages").update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", messageId).select("id").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Impossible de supprimer ce message." }, { status: 403 });
  return NextResponse.json({ deleted: true });
}
