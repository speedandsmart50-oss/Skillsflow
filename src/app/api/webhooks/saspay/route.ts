import { NextResponse } from "next/server";
import { activateSubscription, findPaymentOrder } from "@/lib/payments/activation";
import { processSasPayWebhook } from "@/lib/payments/flow";
import { isSasPayLiveReady, verifySasPayTransaction, verifySasPayWebhook } from "@/lib/payments/saspay";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

function safeHeaders(request: Request) {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    if (!/^(authorization|cookie|set-cookie)$/i.test(key)) headers[key] = value;
  });
  return headers;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const supabase = getSupabaseAdminClient();
  const { data: log, error: logError } = await supabase.from("saspay_webhook_logs")
    .insert({ headers: safeHeaders(request), raw_body: rawBody })
    .select("id")
    .single();
  if (logError || !log) {
    console.error("Could not persist SasPay webhook receipt:", logError?.message ?? "No log row returned");
    return NextResponse.json({ error: "Le journal du webhook est temporairement indisponible." }, { status: 503 });
  }

  const finish = async (status: number, processingStatus: string, fields: Record<string, unknown> = {}) => {
    const { error } = await supabase.from("saspay_webhook_logs").update({
      response_status: status,
      processing_status: processingStatus,
      processed_at: new Date().toISOString(),
      ...fields,
    }).eq("id", log.id);
    if (error) throw new Error(`Could not persist webhook outcome: ${error.message}`);
  };
  const reject = async (status: number, message: string) => {
    try { await finish(status, status >= 500 ? "error" : "rejected", { error_message: message }); }
    catch (error) { console.error("Could not persist SasPay webhook error:", error); }
    return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
  };

  const signatureValid = verifySasPayWebhook(
    rawBody,
    request.headers.get("x-webhook-signature"),
    request.headers.get("x-webhook-timestamp"),
  );
  try { await supabase.from("saspay_webhook_logs").update({ signature_valid: signatureValid }).eq("id", log.id); }
  catch (error) { console.error("Could not persist signature result:", error); }

  if (!signatureValid) return reject(401, "Signature de webhook invalide.");
  if (!isSasPayLiveReady()) return reject(503, "Le service SasPay n'est pas configuré.");

  try {
    const result = await processSasPayWebhook({
      rawBody,
      signature: request.headers.get("x-webhook-signature"),
      timestamp: request.headers.get("x-webhook-timestamp"),
      eventHeader: request.headers.get("x-webhook-event"),
    }, {
      verifySignature: verifySasPayWebhook,
      verifyTransaction: verifySasPayTransaction,
      findOrder: findPaymentOrder,
      activate: async (order, transaction, source) => {
        const activation = await activateSubscription(order.id, source, typeof transaction.id === "string" ? transaction.id : undefined);
        return activation.activated && !activation.alreadyPaid;
      },
      markTerminal: async (order, status, transactionId) => {
        const { error } = await supabase.from("orders").update({
          payment_status: status,
          provider_payment_id: transactionId || null,
        }).eq("id", order.id).eq("payment_status", "pending");
        if (error) throw new Error(`Could not record SasPay ${status} transaction: ${error.message}`);
      },
    });
    try {
      await finish(result.status, result.log, {
        error_message: "body" in result.body && typeof result.body.error === "string" ? result.body.error : null,
        order_reference: "orderReference" in result ? result.orderReference : null,
        provider_payment_id: "providerPaymentId" in result ? result.providerPaymentId : null,
      });
    } catch (error) {
      console.error("Could not persist SasPay webhook outcome:", error);
      return NextResponse.json({ error: "Le résultat du webhook n'a pas pu être journalisé." }, { status: 503 });
    }
    return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown SasPay webhook error";
    console.error("Could not reconcile SasPay webhook:", detail);
    return reject(502, "Impossible de vérifier ou d'enregistrer le paiement auprès de SasPay.");
  }
}
