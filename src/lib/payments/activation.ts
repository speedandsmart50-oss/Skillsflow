import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  resolveSasPayTransaction,
  verifySasPayTransaction,
  type SasPayTransaction,
} from "@/lib/payments/saspay";
import { isMatchingPaidTransaction, reconcileVerifiedTransaction } from "@/lib/payments/flow";
export { isMatchingPaidTransaction } from "@/lib/payments/flow";

export type ActivationSource = "webhook" | "return" | "cron" | "manual";

export type PaymentOrder = {
  id: string;
  user_id: string | null;
  product_id: string | null;
  order_reference: string;
  payment_status: string;
  total_xof: number | string;
  currency: string;
  provider_payment_id: string | null;
  provider_checkout_id: string | null;
  created_at: string;
  profiles?: { email: string } | null;
};

export type ActivationResult =
  | { activated: true; alreadyPaid: boolean; order: PaymentOrder }
  | { activated: false; reason: "pending" | "failed" | "expired" | "not_found" | "mismatch"; order?: PaymentOrder };

export async function findPaymentOrder(reference: string): Promise<PaymentOrder | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, user_id, product_id, order_reference, payment_status, total_xof, currency, provider_payment_id, provider_checkout_id, created_at")
    .eq("order_reference", reference)
    .maybeSingle();
  if (error) throw new Error(`Could not load payment order: ${error.message}`);
  return data as PaymentOrder | null;
}

export async function loadPaymentOrder(orderId: string): Promise<PaymentOrder | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, user_id, product_id, order_reference, payment_status, total_xof, currency, provider_payment_id, provider_checkout_id, created_at")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(`Could not load payment order: ${error.message}`);
  return data as PaymentOrder | null;
}

export async function activateSubscription(
  orderId: string,
  source: ActivationSource,
  hintedTransactionId?: string,
): Promise<ActivationResult> {
  const supabase = getSupabaseAdminClient();
  const order = await loadPaymentOrder(orderId);
  if (!order) return { activated: false, reason: "not_found" };

  if (order.payment_status === "paid") {
    if (!order.provider_payment_id) return { activated: false, reason: "mismatch", order };
    const verified = await verifySasPayTransaction(order.provider_payment_id);
    if (!isMatchingPaidTransaction(order, verified, order.provider_payment_id)) {
      return { activated: false, reason: "mismatch", order };
    }
    await activateVerifiedPayment(order, verified, source);
    return { activated: true, alreadyPaid: true, order };
  }
  if (!(["pending", "failed", "expired"] as string[]).includes(order.payment_status)) {
    return { activated: false, reason: order.payment_status === "expired" ? "expired" : "failed", order };
  }

  let transaction: SasPayTransaction | null = null;
  if (hintedTransactionId) {
    transaction = await verifySasPayTransaction(hintedTransactionId);
  } else if (order.provider_payment_id) {
    transaction = await verifySasPayTransaction(order.provider_payment_id);
  } else if (order.provider_checkout_id) {
    transaction = await resolveSasPayTransaction(order.provider_checkout_id);
  }
  if (!transaction) return { activated: false, reason: "pending", order };

  const result = await reconcileVerifiedTransaction(order, transaction, source, {
    activate: async (targetOrder, verifiedTransaction, activationSource) => {
      const activated = await activateVerifiedPayment(targetOrder as PaymentOrder, verifiedTransaction, activationSource);
      return activated.activated && !activated.alreadyPaid;
    },
    markTerminal: async (targetOrder, status, transactionId) => {
      const { error } = await supabase.from("orders")
        .update({ payment_status: status, provider_payment_id: transactionId || order.provider_payment_id })
        .eq("id", targetOrder.id)
        .eq("payment_status", "pending");
      if (error) throw new Error(`Could not record SasPay ${status} payment: ${error.message}`);
    },
  });
  if (result.activated) return { activated: true, alreadyPaid: result.alreadyPaid, order };
  if (result.reason === "failed" || result.reason === "expired" || result.reason === "pending" || result.reason === "mismatch") {
    return { activated: false, reason: result.reason, order };
  }
  return { activated: false, reason: "pending", order };
}

async function activateVerifiedPayment(
  order: PaymentOrder,
  transaction: SasPayTransaction,
  source: ActivationSource,
): Promise<ActivationResult> {
  if (!isMatchingPaidTransaction(order, transaction)) {
    return { activated: false, reason: "mismatch", order };
  }
  const transactionId = transaction.id as string;
  const supabase = getSupabaseAdminClient();

  const { error } = await supabase.rpc("activate_saspay_order", {
    p_order_id: order.id,
    p_provider_payment_id: transactionId,
    p_activation_source: source,
  });
  if (error) {
    // Concurrent webhook/return/cron calls may win the row lock first. Re-read
    // and accept only the same provider transaction as an idempotent success.
    const current = await loadPaymentOrder(order.id);
    if (current?.payment_status !== "paid" || current.provider_payment_id !== transactionId) {
      throw new Error(`Could not activate SasPay order: ${error.message}`);
    }
    return { activated: true, alreadyPaid: true, order: current };
  }
  return { activated: true, alreadyPaid: false, order };
}

