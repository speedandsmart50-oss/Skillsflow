import { NextResponse, connection } from "next/server";
import { getAuthenticatedUser, getSupabaseUserClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  await connection();
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Connectez-vous pour voir vos skills." }, { status: 401 });
  const supabase = getSupabaseUserClient(request);
  if (!supabase) return NextResponse.json({ error: "Session expirée. Reconnectez-vous." }, { status: 401 });
  const { data: skills, error } = await supabase.from("skills")
    .select("id,slug,name,category_id,short_description,long_description,promise,required_inputs,output_types,workflow,price_cents,product_id,is_active,skill_categories(name,slug)")
    .eq("is_active", true).order("name");
  if (error) {
    console.error("Could not load member skills:", error.message);
    return NextResponse.json({ error: "Bibliothèque indisponible. Appliquez la migration 011." }, { status: 503 });
  }
  const accessResults = await Promise.all((skills ?? []).map((skill) => supabase.rpc("can_access_skill", { p_user_id: user.id, p_skill_id: skill.id })));
  if (accessResults.some((result) => result.error)) return NextResponse.json({ error: "Impossible de vérifier les accès aux skills." }, { status: 503 });
  const items = (skills ?? []).map((skill, index) => ({ ...skill, accessible: accessResults[index].data === true }));
  return NextResponse.json({ items }, { headers: { "Cache-Control": "private, no-store" } });
}
