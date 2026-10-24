import { NextResponse } from "next/server";
import { getAuthenticatedUser, getSupabaseUserClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ skillId: string }> };
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }

export async function GET(request: Request, context: Context) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  const { skillId } = await context.params;
  const supabase = getSupabaseUserClient(request);
  if (!supabase) return NextResponse.json({ error: "Session expirée. Reconnectez-vous." }, { status: 401 });
  const { data: skill, error } = await supabase.from("skills").select("id,slug,name,category_id,short_description,long_description,promise,required_inputs,output_types,workflow,price_cents,product_id,is_active,skill_categories(name,slug)").eq("id", skillId).eq("is_active", true).maybeSingle();
  if (error) return NextResponse.json({ error: "Bibliothèque indisponible." }, { status: 503 });
  if (!skill) return NextResponse.json({ error: "Skill introuvable." }, { status: 404 });
  const { data: access } = await supabase.rpc("can_access_skill", { p_user_id: user.id, p_skill_id: skill.id });
  if (!access) return NextResponse.json({ error: "Accès non inclus. Consultez le catalogue pour acheter ce skill." }, { status: 403 });
  const [{ data: configuration }, { data: agentProfile }] = await Promise.all([
    supabase.from("skill_configurations").select("id,configuration_data,status,updated_at").eq("user_id", user.id).eq("skill_id", skill.id).maybeSingle(),
    supabase.from("communication_profiles").select("id,summary,version,is_active,updated_at").eq("user_id", user.id).eq("skill_id", skill.id).maybeSingle(),
  ]);
  return NextResponse.json({ skill, configuration, profile: agentProfile }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(request: Request, context: Context) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  const { skillId } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  if (!isObject(body) || !isObject(body.configuration)) return NextResponse.json({ error: "Configuration invalide." }, { status: 400 });
  if (JSON.stringify(body.configuration).length > 30000) return NextResponse.json({ error: "Configuration trop volumineuse." }, { status: 413 });
  const supabase = getSupabaseUserClient(request);
  if (!supabase) return NextResponse.json({ error: "Session expirée. Reconnectez-vous." }, { status: 401 });
  const { data: access } = await supabase.rpc("can_access_skill", { p_user_id: user.id, p_skill_id: skillId });
  if (!access) return NextResponse.json({ error: "Accès à ce skill requis." }, { status: 403 });
  const { data, error } = await supabase.from("skill_configurations").upsert({ user_id: user.id, skill_id: skillId, configuration_data: body.configuration, status: "in_progress", updated_at: new Date().toISOString() }, { onConflict: "user_id,skill_id" }).select("id,configuration_data,status,updated_at").single();
  if (error) { console.error("Could not save skill configuration:", error.message); return NextResponse.json({ error: "Impossible d’enregistrer la configuration." }, { status: 500 }); }
  return NextResponse.json({ configuration: data }, { headers: { "Cache-Control": "private, no-store" } });
}
