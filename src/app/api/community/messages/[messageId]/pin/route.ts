import { NextResponse } from "next/server";
import { getCommunitySession, isSameOriginRequest, isValidUuid } from "@/lib/community/server";

export async function POST(request: Request, { params }: { params: Promise<{ messageId: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Requête non autorisée." }, { status: 403 });
  const context = await getCommunitySession();
  if (!context) return NextResponse.json({ error: "Connectez-vous pour continuer." }, { status: 401 });
  const { messageId } = await params;
  if (!isValidUuid(messageId)) return NextResponse.json({ error: "Message introuvable." }, { status: 404 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Données invalides." }, { status: 400 }); }
  const pinned = body && typeof body === "object" ? (body as { pinned?: unknown }).pinned : undefined;
  if (typeof pinned !== "boolean") return NextResponse.json({ error: "Action invalide." }, { status: 400 });
  const { error } = await context.supabase.rpc("pin_community_message", { p_message_id: messageId, p_pin: pinned });
  if (error) return NextResponse.json({ error: "Action réservée à l’équipe de modération." }, { status: 403 });
  return NextResponse.json({ pinned });
}
