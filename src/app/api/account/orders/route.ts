import { NextResponse } from "next/server";
import { getAuthenticatedUser, getSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Connectez-vous pour consulter vos commandes." }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Could not load customer profile:", profileError.message);
    return NextResponse.json({ error: "Impossible de charger votre profil." }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("orders")
    .select("id, total, total_xof, currency, coupon_code, payment_status, created_at, paid_at, products(name, slug)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Could not load customer orders:", error.message);
    return NextResponse.json({ error: "Impossible de charger vos commandes." }, { status: 500 });
  }

  return NextResponse.json({ orders: data, role: profile?.role ?? "customer" });
}
