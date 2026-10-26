import { NextResponse } from "next/server";
import { getCommunitySession, isSameOriginRequest, isValidUuid } from "@/lib/community/server";

const ALLOWED_EMOJI = new Set(["👍", "❤️", "💪", "🎯", "🙏"]);

export async function POST(request: Request, { params }: { params: Promise<{ messageId: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Requête non autorisée." }, { status: 403 });
  const context = await getCommunitySession();
  if (!context) return NextResponse.json({ error: "Connectez-vous pour réagir." }, { status: 401 });
  const { messageId } = await params;
  if (!isValidUuid(messageId)) return NextResponse.json({ error: "Message introuvable." }, { status: 404 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Données invalides." }, { status: 400 }); }
  const emoji = body && typeof body === "object" ? (body as { emoji?: unknown }).emoji : undefined;
  if (typeof emoji !== "string" || !ALLOWED_EMOJI.has(emoji)) return NextResponse.json({ error: "Réaction non autorisée." }, { status: 400 });

  const { data: message, error: messageError } = await context.supabase.from("messages").select("id, channel_id").eq("id", messageId).is("deleted_at", null).maybeSingle();
  if (messageError || !message) return NextResponse.json({ error: "Message introuvable." }, { status: 404 });
  const { data: existing, error: findError } = await context.supabase.from("reactions").select("id").eq("message_id", messageId).eq("user_id", context.user.id).eq("emoji", emoji).maybeSingle();
  if (findError) return NextResponse.json({ error: "Impossible d’enregistrer la réaction." }, { status: 403 });
  if (existing) {
    const { error } = await context.supabase.from("reactions").delete().eq("id", existing.id);
    if (error) return NextResponse.json({ error: "Impossible de retirer la réaction." }, { status: 403 });
    return NextResponse.json({ active: false });
  }
  const { error } = await context.supabase.from("reactions").insert({ message_id: messageId, channel_id: message.channel_id, user_id: context.user.id, emoji });
  if (error) return NextResponse.json({ error: "Impossible d’enregistrer la réaction." }, { status: 403 });
  return NextResponse.json({ active: true });
}
