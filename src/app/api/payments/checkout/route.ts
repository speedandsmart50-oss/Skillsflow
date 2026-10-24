import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isSasPayLiveReady, saspayRequest } from "@/lib/payments/saspay";
import {
  calculateProductPrice,
  InvalidCouponError,
  PRODUCT_SLUG,
} from "@/lib/pricing";
import { getAuthenticatedUser, getSupabaseAdminClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  if (process.env.SKILLFLOW_COMMERCE_ENABLED !== "true") {
    return NextResponse.json(
      { error: "Les ventes sont temporairement fermées." },
      { status: 503 },
    );
  }

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

  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  let appOrigin: string;
  try {
    const appUrl = new URL(configuredAppUrl ?? "");
    if (appUrl.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && appUrl.hostname === "localhost")) {
      throw new Error("The public application URL must use HTTPS.");
    }
    appOrigin = appUrl.origin;
  } catch {
    return NextResponse.json(
      { error: "L'adresse publique du site n'est pas correctement configurée." },
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
  const productSlug = body.productSlug === undefined ? PRODUCT_SLUG : body.productSlug;
  if (typeof productSlug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(productSlug)) {
    return NextResponse.json({ error: "Le skill choisi est invalide." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, slug, status, catalog_status, archived_at, zip_path, price_eur, price_xof")
    .eq("slug", productSlug)
    .maybeSingle();
  if (productError) {
    console.error("Could not load checkout product:", productError.message);
    return NextResponse.json({ error: "Impossible de vérifier le skill choisi." }, { status: 500 });
  }
  if (!product || product.status !== "published" || product.archived_at) {
    return NextResponse.json({ error: "Ce skill n’est pas disponible dans le catalogue." }, { status: 404 });
  }
  if (product.catalog_status !== "disponible") {
    return NextResponse.json({ error: "Ce skill n’est pas encore disponible à l’achat." }, { status: 409 });
  }
  if (!product.zip_path) {
    return NextResponse.json({ error: "Le pack n’est pas encore prêt pour le paiement." }, { status: 503 });
  }

  const productPriceEur = Number(product.price_eur);
  const productPriceXof = Number(product.price_xof);
  if (
    !Number.isFinite(productPriceEur)
    || productPriceEur < 0
    || !Number.isSafeInteger(productPriceXof)
    || productPriceXof < 0
  ) {
    console.error("Checkout product has invalid prices:", product.id);
    return NextResponse.json({ error: "Le prix de ce skill n’est pas correctement configuré." }, { status: 503 });
  }

  let price: ReturnType<typeof calculateProductPrice>;
  try {
    price = calculateProductPrice(
      typeof body.coupon === "string" ? body.coupon : "",
      product.slug,
      productPriceEur,
      productPriceXof,
    );
  } catch (error) {
    if (error instanceof InvalidCouponError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const { data: existingOrder, error: existingError } = await supabase
    .from("orders")
    .select("id, user_id, product_id, payment_status, checkout_url, coupon_code")
    .eq("request_id", body.requestId)
    .maybeSingle();

  if (existingError) {
    console.error("Could not check checkout idempotency:", existingError.message);
    return NextResponse.json({ error: "Impossible de préparer la commande." }, { status: 500 });
  }

  if (existingOrder) {
    if (existingOrder.user_id !== user.id
      || existingOrder.product_id !== product.id
      || existingOrder.coupon_code !== price.couponCode) {
      return NextResponse.json({ error: "Identifiant de tentative déjà utilisé." }, { status: 409 });
    }
    if (existingOrder.payment_status === "pending" && existingOrder.checkout_url) {
      return NextResponse.json({ checkoutUrl: existingOrder.checkout_url });
    }
    return NextResponse.json({ error: "Cette tentative de paiement a déjà été traitée." }, { status: 409 });
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
        return_url: `${appOrigin}/checkout/complete?order=${order.id}`,
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
