import { NextResponse } from "next/server";
import { getAuthenticatedUser, getSupabaseUserClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Connectez-vous pour vérifier la commande." }, { status: 401 });

  const orderId = new URL(request.url).searchParams.get("order");
  if (!orderId || !UUID_PATTERN.test(orderId)) {
    return NextResponse.json({ error: "Référence de commande invalide." }, { status: 400 });
  }

  const supabase = getSupabaseUserClient(request);
  if (!supabase) return NextResponse.json({ error: "Session expirée. Reconnectez-vous." }, { status: 401 });

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, payment_status, total_xof, currency, paid_at, products(name, slug)")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Could not load payment status:", error.message);
    return NextResponse.json({ error: "Le statut du paiement est temporairement indisponible." }, { status: 503 });
  }
  if (!order) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });

  return NextResponse.json({
    status: order.payment_status,
    amountXof: order.total_xof,
    currency: order.currency,
    paidAt: order.paid_at,
    product: order.products,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
