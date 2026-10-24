import { NextResponse } from "next/server";
import { recordAdminAction, requireAdminApiUser } from "@/lib/security/admin-api";

export async function GET(request: Request) {
  const access = await requireAdminApiUser(request);
  if (!access.ok) return access.response;
  const [{ data: skills, error }, { data: categories, error: categoryError }] = await Promise.all([
    access.supabase.from("skills").select("id,slug,name,category_id,short_description,price_cents,is_active,is_included_in_membership,product_id").order("name"),
    access.supabase.from("skill_categories").select("id,slug,name,sort_order").order("sort_order"),
  ]);
  if (error || categoryError) return NextResponse.json({ error: "Appliquez la migration 011 pour gérer la bibliothèque." }, { status: 503 });
  return NextResponse.json({ skills, categories }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const access = await requireAdminApiUser(request);
  if (!access.ok) return access.response;
  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== "object" || !body || Array.isArray(body)) return NextResponse.json({ error: "Modification invalide." }, { status: 400 });
  const input = body as Record<string, unknown>;
  if (typeof input.id !== "string") return NextResponse.json({ error: "Skill invalide." }, { status: 400 });
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof input.is_active === "boolean") update.is_active = input.is_active;
  if (typeof input.price_cents === "number" && Number.isSafeInteger(input.price_cents) && input.price_cents >= 0) update.price_cents = input.price_cents;
  if (typeof input.product_id === "string" || input.product_id === null) update.product_id = input.product_id;
  if (typeof input.category_id === "string") update.category_id = input.category_id;
  if (typeof input.short_description === "string" && input.short_description.length <= 500) update.short_description = input.short_description.trim();
  if (Object.keys(update).length === 1) return NextResponse.json({ error: "Aucun champ valide." }, { status: 400 });
  const { data: existing } = await access.supabase.from("skills").select("id,name").eq("id", input.id).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Skill introuvable." }, { status: 404 });
  try { await recordAdminAction(access.supabase, access.user.id, "library.skill.update", "skill", input.id, "requested", { fields: Object.keys(update) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Journal indisponible." }, { status: 500 }); }
  const { data, error } = await access.supabase.from("skills").update(update).eq("id", input.id).select("id,slug,name,category_id,short_description,price_cents,is_active,is_included_in_membership,product_id").single();
  if (error) return NextResponse.json({ error: "Impossible de modifier ce skill." }, { status: 500 });
  await recordAdminAction(access.supabase, access.user.id, "library.skill.update", "skill", input.id, "completed", { fields: Object.keys(update) });
  return NextResponse.json({ skill: data }, { headers: { "Cache-Control": "private, no-store" } });
}
