import { NextResponse } from "next/server";
import { getCommunitySession, isSameOriginRequest, isValidUuid } from "@/lib/community/server";

export async function POST(request: Request, { params }: { params: Promise<{ messageId: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Requête non autorisée." }, { status: 403 });
  const context = await getCommunitySession();
  if (!context) return NextResponse.json({ error: "Connectez-vous pour signaler un message." }, { status: 401 });
  const { messageId } = await params;
  if (!isValidUuid(messageId)) return NextResponse.json({ error: "Message introuvable." }, { status: 404 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Données invalides." }, { status: 400 }); }
  const reason = body && typeof body === "object" ? (body as { reason?: unknown }).reason : undefined;
  if (typeof reason !== "string" || reason.trim().length < 3 || reason.trim().length > 500) {
    return NextResponse.json({ error: "Expliquez le signalement en 3 à 500 caractères." }, { status: 400 });
  }
  const { error } = await context.supabase.from("reports").insert({ message_id: messageId, reporter_id: context.user.id, reason: reason.trim() });
  if (error) {
    const duplicate = error.code === "23505";
    return NextResponse.json({ error: duplicate ? "Vous avez déjà signalé ce message." : "Impossible d’envoyer le signalement." }, { status: duplicate ? 409 : 403 });
  }
  return NextResponse.json({ reported: true }, { status: 201 });
}
