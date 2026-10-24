import { NextResponse } from "next/server";
import { getAuthenticatedUser, getSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Connectez-vous pour accéder à l’administration." }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Could not verify admin access:", profileError.message);
    return NextResponse.json({ error: "Impossible de vérifier vos droits." }, { status: 500 });
  }
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Accès réservé aux administrateurs." }, { status: 403 });
  }

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, total, total_xof, currency, coupon_code, payment_status, created_at, paid_at, products(name, slug)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (ordersError) {
    console.error("Could not load admin orders:", ordersError.message);
    return NextResponse.json({ error: "Impossible de charger les commandes." }, { status: 500 });
  }

  return NextResponse.json({ orders });
}
