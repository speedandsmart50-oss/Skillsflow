import { verifySasPayWebhook, type SasPayTransaction } from "@/lib/payments/saspay";

export type PaymentSource = "webhook" | "return" | "cron" | "manual";
export type PaymentOrderSnapshot = {
  id: string;
  order_reference: string;
  total_xof: number | string;
  currency: string;
};

export function isMatchingPaidTransaction(
  order: PaymentOrderSnapshot,
  transaction: SasPayTransaction,
  expectedId?: string,
) {
  const transactionId = typeof transaction.id === "string" ? transaction.id : "";
  const amount = Number(transaction.requested_amount ?? transaction.amount);
  return transaction.status === "SUCCESS"
    && Boolean(transactionId)
    && (!expectedId || transactionId === expectedId)
    && transaction.description === order.order_reference
    && transaction.currency === order.currency
    && Number.isSafeInteger(amount)
    && amount === Number(order.total_xof);
}

export async function reconcileVerifiedTransaction<T extends PaymentOrderSnapshot>(
  order: T,
  transaction: SasPayTransaction,
  source: PaymentSource,
  operations: {
    activate: (order: T, transaction: SasPayTransaction, source: PaymentSource) => Promise<boolean>;
    markTerminal: (order: T, status: "failed" | "expired", transactionId: string) => Promise<void>;
  },
) {
  const transactionId = typeof transaction.id === "string" ? transaction.id : "";
  if (transaction.status === "SUCCESS") {
    if (!isMatchingPaidTransaction(order, transaction)) return { activated: false as const, reason: "mismatch" as const };
    const alreadyPaid = !(await operations.activate(order, transaction, source));
    return { activated: true as const, alreadyPaid };
  }
  if (transaction.status === "FAILED" || transaction.status === "EXPIRED" || transaction.status === "CANCELLED") {
    const status = transaction.status === "EXPIRED" ? "expired" : "failed";
    await operations.markTerminal(order, status, transactionId);
    return { activated: false as const, reason: status };
  }
  return { activated: false as const, reason: "pending" as const };
}

export async function processSasPayWebhook<T extends PaymentOrderSnapshot>(
  input: { rawBody: string; signature: string | null; timestamp: string | null; eventHeader: string | null },
  dependencies: {
    verifySignature: typeof verifySasPayWebhook;
    verifyTransaction: (id: string) => Promise<SasPayTransaction>;
    findOrder: (reference: string) => Promise<T | null>;
    activate: (order: T, transaction: SasPayTransaction, source: PaymentSource) => Promise<boolean>;
    markTerminal: (order: T, status: "failed" | "expired", transactionId: string) => Promise<void>;
  },
) {
  if (!dependencies.verifySignature(input.rawBody, input.signature, input.timestamp)) {
    return { status: 401, body: { error: "Signature de webhook invalide." }, log: "rejected" as const };
  }
  let payload: { event?: unknown; data?: { id?: unknown } };
  try { payload = JSON.parse(input.rawBody); }
  catch { return { status: 400, body: { error: "Corps de webhook invalide." }, log: "rejected" as const }; }
  if (typeof payload.event !== "string" || payload.event !== input.eventHeader) {
    return { status: 400, body: { error: "Événement de webhook incohérent." }, log: "rejected" as const };
  }
  if (payload.event !== "transaction.success" && payload.event !== "transaction.failed") {
    return { status: 200, body: { received: true, ignored: true }, log: "ignored" as const };
  }
  if (typeof payload.data?.id !== "string") {
    return { status: 400, body: { error: "Webhook de paiement incomplet." }, log: "rejected" as const };
  }

  const transaction = await dependencies.verifyTransaction(payload.data.id);
  if (transaction.id !== payload.data.id || typeof transaction.description !== "string") {
    return { status: 400, body: { error: "Transaction SasPay non reconnue." }, log: "rejected" as const, providerPaymentId: payload.data.id };
  }
  const order = await dependencies.findOrder(transaction.description);
  if (!order) {
    return { status: 404, body: { error: "Commande introuvable." }, log: "rejected" as const, orderReference: transaction.description, providerPaymentId: payload.data.id };
  }
  if (payload.event === "transaction.failed" && transaction.status !== "FAILED") {
    return { status: 400, body: { error: "Le statut confirmé par SasPay ne correspond pas à l'événement." }, log: "rejected" as const, orderReference: order.order_reference, providerPaymentId: payload.data.id };
  }
  const result = await reconcileVerifiedTransaction(order, transaction, "webhook", dependencies);
  if (result.reason === "mismatch") {
    return { status: 400, body: { error: "Le montant, la devise, le plan ou la référence ne correspond pas." }, log: "rejected" as const, orderReference: order.order_reference, providerPaymentId: payload.data.id };
  }
  if (result.reason === "pending") {
    return { status: 409, body: { error: "Le paiement n'est pas confirmé par SasPay." }, log: "rejected" as const, orderReference: order.order_reference, providerPaymentId: payload.data.id };
  }
  return {
    status: 200,
    body: { received: true },
    log: "processed" as const,
    orderReference: order.order_reference,
    providerPaymentId: payload.data.id,
    alreadyPaid: result.activated ? result.alreadyPaid : false,
  };
}
