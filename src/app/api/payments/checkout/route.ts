import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isSasPayLiveReady, saspayRequest } from "@/lib/payments/saspay";
import {
  ADMIN_COUPON_CODE,
  calculateProductPrice,
  INITIAL_LIVE_TRIAL_PRICE_XOF,
  InvalidCouponError,
} from "@/lib/pricing";
import { isAllowlistedAdmin } from "@/lib/security/admin";
import { getAuthenticatedUser, getSupabaseAdminClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user || !user.email) {
    return NextResponse.json({ error: "Connectez-vous avant de payer." }, { status: 401 });
  }

  if (!isSasPayLiveReady()) {
    return NextResponse.json(
      { error: "Le paiement SasPay n'est pas encore configuré pour la production." },
      { status: 503 },
    );
  }

  if (!user.email_confirmed_at) {
    return NextResponse.json({ error: "Confirmez votre adresse e-mail avant de payer." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  if (!isRecord(body) || typeof body.requestId !== "string" || !UUID_PATTERN.test(body.requestId)) {
    return NextResponse.json({ error: "Identifiant de tentative invalide." }, { status: 400 });
  }
  if (body.coupon !== undefined && typeof body.coupon !== "string") {
    return NextResponse.json({ error: "Code de réduction invalide." }, { status: 400 });
  }

  let price: ReturnType<typeof calculateProductPrice>;
  try {
    price = calculateProductPrice(typeof body.coupon === "string" ? body.coupon : "");
  } catch (error) {
    if (error instanceof InvalidCouponError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const adminEmail = process.env.SKILLFLOW_ADMIN_EMAIL;
  if (price.couponCode === ADMIN_COUPON_CODE && !adminEmail) {
    return NextResponse.json({ error: "Le compte administrateur n'est pas configuré." }, { status: 503 });
  }
  if (
    (price.couponCode === ADMIN_COUPON_CODE || INITIAL_LIVE_TRIAL_PRICE_XOF !== null)
    && !isAllowlistedAdmin(user.email, Boolean(user.email_confirmed_at), adminEmail)
  ) {
    return NextResponse.json(
      { error: "Cette offre est réservée au compte autorisé." },
      { status: 403 },
    );
  }

  const supabase = getSupabaseAdminClient();
  const { data: existingOrder, error: existingError } = await supabase
    .from("orders")
    .select("id, user_id, payment_status, checkout_url, coupon_code")
    .eq("request_id", body.requestId)
    .maybeSingle();

  if (existingError) {
    console.error("Could not check checkout idempotency:", existingError.message);
    return NextResponse.json({ error: "Impossible de préparer la commande." }, { status: 500 });
  }

  if (existingOrder) {
    if (existingOrder.user_id !== user.id || existingOrder.coupon_code !== price.couponCode) {
      return NextResponse.json({ error: "Identifiant de tentative déjà utilisé." }, { status: 409 });
    }
    if (existingOrder.payment_status === "pending" && existingOrder.checkout_url) {
      return NextResponse.json({ checkoutUrl: existingOrder.checkout_url });
    }
    return NextResponse.json({ error: "Cette tentative de paiement a déjà été traitée." }, { status: 409 });
  }

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, status, zip_path")
    .eq("slug", price.productSlug)
    .maybeSingle();

  if (productError || !product || product.status !== "published" || !product.zip_path) {
    console.error("Live product is not ready:", productError?.message ?? "not found or not published");
    return NextResponse.json(
      { error: "Le pack n'est pas encore publié dans le catalogue de production." },
      { status: 503 },
    );
  }

  const pathParts = product.zip_path.split("/");
  const fileName = pathParts.pop();
  const folder = pathParts.join("/");
  if (!fileName) {
    console.error("Published product has an invalid storage path:", product.id);
    return NextResponse.json({ error: "Le fichier du pack n'est pas correctement configuré." }, { status: 503 });
  }
  const { data: storedFiles, error: storageError } = await supabase.storage
    .from("product-packs")
    .list(folder, { search: fileName, limit: 10 });
  if (storageError || !storedFiles?.some((file) => file.name === fileName)) {
    console.error("Published product archive is not available:", storageError?.message ?? product.zip_path);
    return NextResponse.json({ error: "Le fichier du pack n'est pas encore disponible." }, { status: 503 });
  }

  const orderId = randomUUID();
  const orderReference = `SkillFlow order ${orderId}`;
  const { data: order, error: insertError } = await supabase
    .from("orders")
    .insert({
      id: orderId,
      user_id: user.id,
      product_id: product.id,
      total: price.totalEur,
      total_xof: price.totalXof,
      subtotal_eur: price.subtotalEur,
      discount_eur: price.discountEur,
      coupon_code: price.couponCode,
      currency: "XOF",
      payment_status: "pending",
      order_reference: orderReference,
      request_id: body.requestId,
    })
    .select("id")
    .single();

  if (insertError || !order) {
    console.error("Could not create checkout order:", insertError?.message ?? "no order returned");
    return NextResponse.json({ error: "Impossible de créer la commande." }, { status: 500 });
  }

  const customerName = typeof user.user_metadata.full_name === "string"
    ? user.user_metadata.full_name.slice(0, 120)
    : user.email;

  try {
    const session = await saspayRequest("/checkout-sessions/", {
      method: "POST",
      body: JSON.stringify({
        amount: price.totalXof.toFixed(2),
        currency: "XOF",
        country: "BJ",
        description: orderReference,
        customer_email: user.email,
        customer_name: customerName,
        return_url: `${new URL(request.url).origin}/checkout/complete?order=${order.id}`,
        metadata: { skillflow_order_id: order.id },
      }),
    });

    const checkoutUrl = typeof session.checkout_url === "string" ? session.checkout_url : "";
    const sessionId = typeof session.id === "string" ? session.id : "";
    const parsedCheckoutUrl = checkoutUrl ? new URL(checkoutUrl) : null;
    if (!sessionId || !parsedCheckoutUrl || parsedCheckoutUrl.protocol !== "https:" || parsedCheckoutUrl.hostname !== "pay.saspay.me") {
      throw new Error("SasPay did not return a valid hosted checkout URL.");
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        provider_checkout_id: sessionId,
        checkout_url: checkoutUrl,
      })
      .eq("id", order.id)
      .eq("payment_status", "pending");

    if (updateError) {
      console.error("Could not store SasPay checkout session:", updateError.message);
      return NextResponse.json({ error: "La session de paiement n'a pas pu être enregistrée." }, { status: 500 });
    }

    return NextResponse.json({ checkoutUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown SasPay error";
    console.error("SasPay checkout failed:", message);
    await supabase
      .from("orders")
      .update({ payment_status: "failed" })
      .eq("id", order.id)
      .eq("payment_status", "pending");
    return NextResponse.json(
      { error: "SasPay n'a pas pu créer la session de paiement." },
      { status: 502 },
    );
  }
}
