import { NextResponse } from "next/server";
import { ADMIN_COUPON_CODE } from "@/lib/pricing";
import { isSasPayLiveReady, saspayRequest, verifySasPayWebhook } from "@/lib/payments/saspay";
import { isAllowlistedAdmin } from "@/lib/security/admin";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type SasPayWebhook = {
  event?: unknown;
  data?: {
    id?: unknown;
  };
};

type VerifiedTransaction = {
  id?: unknown;
  status?: unknown;
  currency?: unknown;
  requested_amount?: unknown;
  amount?: unknown;
  description?: unknown;
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-webhook-signature");
  const timestamp = request.headers.get("x-webhook-timestamp");
  const eventHeader = request.headers.get("x-webhook-event");

  if (!verifySasPayWebhook(rawBody, signature, timestamp)) {
    return NextResponse.json({ error: "Signature de webhook invalide." }, { status: 401 });
  }

  let payload: SasPayWebhook;
  try {
    payload = JSON.parse(rawBody) as SasPayWebhook;
  } catch {
    return NextResponse.json({ error: "Corps de webhook invalide." }, { status: 400 });
  }

  if (typeof payload.event !== "string" || payload.event !== eventHeader) {
    return NextResponse.json({ error: "Événement de webhook incohérent." }, { status: 400 });
  }
  if (payload.event !== "transaction.success" && payload.event !== "transaction.failed") {
    return NextResponse.json({ received: true, ignored: true });
  }
  if (!isSasPayLiveReady() || typeof payload.data?.id !== "string") {
    return NextResponse.json({ error: "Webhook de paiement incomplet." }, { status: 503 });
  }

  let transaction: VerifiedTransaction;
  try {
    transaction = await saspayRequest(
      `/payments/${encodeURIComponent(payload.data.id)}/verify/`,
    ) as VerifiedTransaction;
  } catch (error) {
    console.error("Could not verify SasPay transaction:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Impossible de vérifier le paiement auprès de SasPay." }, { status: 502 });
  }

  if (transaction.id !== payload.data.id || typeof transaction.description !== "string") {
    return NextResponse.json({ error: "Transaction SasPay non reconnue." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, user_id, coupon_code, payment_status, total_xof, currency, provider_payment_id")
    .eq("order_reference", transaction.description)
    .maybeSingle();

  if (orderError) {
    console.error("Could not locate SasPay order:", orderError.message);
    return NextResponse.json({ error: "Impossible de retrouver la commande." }, { status: 500 });
  }
  if (!order) {
    return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  }
  if (order.payment_status === "paid") {
    return order.provider_payment_id === payload.data.id
      ? NextResponse.json({ received: true })
      : NextResponse.json({ error: "Paiement déjà associé à une autre transaction." }, { status: 409 });
  }
  if (order.payment_status !== "pending") {
    return NextResponse.json({ error: "Cette commande n'est plus en attente." }, { status: 409 });
  }

  const amount = Number(transaction.requested_amount ?? transaction.amount);
  const status = transaction.status;
  if (
    transaction.currency !== order.currency
    || !Number.isSafeInteger(amount)
    || amount !== Number(order.total_xof)
  ) {
    return NextResponse.json({ error: "Le montant ou la devise du paiement ne correspond pas." }, { status: 400 });
  }
  if ((payload.event === "transaction.success" && status !== "SUCCESS")
    || (payload.event === "transaction.failed" && status !== "FAILED")) {
    return NextResponse.json({ error: "Le statut confirmé par SasPay ne correspond pas à l'événement." }, { status: 400 });
  }

  const paid = payload.event === "transaction.success";
  if (paid && order.coupon_code === ADMIN_COUPON_CODE) {
    const adminEmail = process.env.SKILLFLOW_ADMIN_EMAIL;
    if (!adminEmail || !order.user_id) {
      console.error("Admin coupon order has no configured allowlisted account.");
      return NextResponse.json({ error: "Le compte administrateur n'est pas configuré." }, { status: 503 });
    }

    const { data: authResult, error: authError } = await supabase.auth.admin.getUserById(order.user_id);
    const paidUser = authResult.user;
    if (
      authError
      || !isAllowlistedAdmin(paidUser?.email, Boolean(paidUser?.email_confirmed_at), adminEmail)
    ) {
      console.error("Admin coupon order does not match the verified allowlisted account.");
      return NextResponse.json({ error: "Le compte ne peut pas recevoir le rôle administrateur." }, { status: 403 });
    }
  }

  const { error: updateError } = paid
    ? await supabase.rpc("complete_saspay_order", {
      p_order_id: order.id,
      p_provider_payment_id: payload.data.id,
      p_grant_admin: order.coupon_code === ADMIN_COUPON_CODE,
    })
    : await supabase
      .from("orders")
      .update({ payment_status: "failed", provider_payment_id: payload.data.id })
      .eq("id", order.id)
      .eq("payment_status", "pending");

  if (updateError) {
    console.error("Could not reconcile SasPay payment:", updateError.message);
    return NextResponse.json({ error: "Impossible d'enregistrer le statut du paiement." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
