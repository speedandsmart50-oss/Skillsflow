import { NextResponse } from "next/server";
import { activateSubscription } from "@/lib/payments/activation";
import { getAuthenticatedUser, getSupabaseAdminClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Connectez-vous pour vérifier la commande." }, { status: 401 });

  const orderId = new URL(request.url).searchParams.get("order");
  if (!orderId || !UUID_PATTERN.test(orderId)) {
    return NextResponse.json({ error: "Référence de commande invalide." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, user_id, payment_status, total_xof, currency, paid_at, products(name, slug)")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    console.error("Could not load payment status:", error.message);
    return NextResponse.json({ error: "Le statut du paiement est temporairement indisponible." }, { status: 503 });
  }
  if (!order) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });

  if (order.payment_status !== "paid") {
    try {
      const result = await activateSubscription(orderId, "return");
      if (result.activated) {
        const { data: refreshed } = await supabase.from("orders")
          .select("payment_status, paid_at")
          .eq("id", orderId)
          .single();
        order.payment_status = refreshed?.payment_status ?? "paid";
        order.paid_at = refreshed?.paid_at ?? new Date().toISOString();
      } else if (result.reason === "failed" || result.reason === "expired") {
        order.payment_status = result.reason;
      }
    } catch (verificationError) {
      // The callback page remains useful during a SasPay outage; the scheduled
      // reconciler will retry this same persisted order.
      console.error("SasPay return verification deferred:", verificationError instanceof Error ? verificationError.message : "Unknown verification error");
    }
  }

  return NextResponse.json({
    status: order.payment_status,
    amountXof: order.total_xof,
    currency: order.currency,
    paidAt: order.paid_at,
    product: order.products,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
