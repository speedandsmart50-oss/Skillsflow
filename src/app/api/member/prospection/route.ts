import { NextResponse } from "next/server";
import { getAuthenticatedUser, getSupabaseAdminClient } from "@/lib/supabase/server";

const stages = new Set(["new", "contacted", "presentation", "follow-up", "won", "lost"]);

async function requirePaidUser(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return { error: NextResponse.json({ error: "Connectez-vous pour utiliser Prospection." }, { status: 401 }) };
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("has_active_member_subscription", { p_user_id: user.id });
  if (error || !data) return { error: NextResponse.json({ error: "Un abonnement actif est requis pour utiliser Prospection." }, { status: 403 }) };
  return { user, supabase };
}

export async function GET(request: Request) {
  const access = await requirePaidUser(request);
  if (access.error) return access.error;
  const { data, error } = await access.supabase.from("prospection_prospects").select("id,name,company,channel,channel_url,note,stage,created_at").eq("user_id", access.user.id).order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Impossible de charger votre pipeline." }, { status: 503 });
  return NextResponse.json({ prospects: (data ?? []).map((item) => ({ ...item, channelUrl: item.channel_url, createdAt: item.created_at })) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const access = await requirePaidUser(request);
  if (access.error) return access.error;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Données invalides." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  const input = body as Record<string, unknown>;
  if (typeof input.name !== "string" || input.name.trim().length < 1 || input.name.trim().length > 100 || typeof input.company !== "string" || input.company.length > 100 || typeof input.channel !== "string" || input.channel.length > 40 || typeof input.channelUrl !== "string" || input.channelUrl.length > 500 || typeof input.note !== "string" || input.note.length > 180) return NextResponse.json({ error: "Vérifiez les informations du contact." }, { status: 400 });
  const { data, error } = await access.supabase.from("prospection_prospects").insert({ user_id: access.user.id, name: input.name.trim(), company: input.company.trim(), channel: input.channel, channel_url: input.channelUrl, note: input.note.trim() }).select("id,name,company,channel,channel_url,note,stage,created_at").single();
  if (error) return NextResponse.json({ error: "Impossible d’ajouter ce contact." }, { status: 503 });
  return NextResponse.json({ prospect: { ...data, channelUrl: data.channel_url, createdAt: data.created_at } }, { status: 201 });
}

export async function PATCH(request: Request) {
  const access = await requirePaidUser(request);
  if (access.error) return access.error;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Données invalides." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  const input = body as Record<string, unknown>;
  if (typeof input.id !== "string" || typeof input.stage !== "string" || !stages.has(input.stage)) return NextResponse.json({ error: "Étape invalide." }, { status: 400 });
  const { error } = await access.supabase.from("prospection_prospects").update({ stage: input.stage, updated_at: new Date().toISOString() }).eq("id", input.id).eq("user_id", access.user.id);
  if (error) return NextResponse.json({ error: "Impossible de mettre à jour ce contact." }, { status: 503 });
  return NextResponse.json({ saved: true });
}

export async function DELETE(request: Request) {
  const access = await requirePaidUser(request);
  if (access.error) return access.error;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Contact invalide." }, { status: 400 });
  const { error } = await access.supabase.from("prospection_prospects").delete().eq("id", id).eq("user_id", access.user.id);
  if (error) return NextResponse.json({ error: "Impossible de supprimer ce contact." }, { status: 503 });
  return NextResponse.json({ deleted: true });
}

