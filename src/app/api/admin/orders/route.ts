import { NextResponse } from "next/server";
import { recordAdminAction, requireAdminApiUser } from "@/lib/security/admin-api";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request: Request) {
  const access = await requireAdminApiUser(request);
  if (!access.ok) return access.response;

  const status = new URL(request.url).searchParams.get("status");
  if (status && !["pending", "paid", "failed"].includes(status)) {
    return NextResponse.json({ error: "Filtre de commande invalide." }, { status: 400 });
  }

  let query = access.supabase
    .from("orders")
    .select("id, user_id, product_id, total, total_xof, currency, coupon_code, payment_status, created_at, paid_at, profiles(email), products(name, slug)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (status) query = query.eq("payment_status", status);

  const { data, error } = await query;
  if (error) {
    console.error("Could not load admin orders:", error.message);
    return NextResponse.json({ error: "Impossible de charger les commandes." }, { status: 500 });
  }

  return NextResponse.json({ orders: data }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const access = await requireAdminApiUser(request);
  if (!access.ok) return access.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "La demande est invalide." }, { status: 400 });
  }
  if (
    !isRecord(body)
    || typeof body.orderId !== "string"
    || !UUID_PATTERN.test(body.orderId)
    || body.action !== "restore_access"
    || body.confirmation !== "RELANCER"
  ) {
    return NextResponse.json({ error: "Confirmez la relance d’accès à partir d’une commande valide." }, { status: 400 });
  }

  const { data: order, error: orderError } = await access.supabase
    .from("orders")
    .select("id, user_id, product_id, payment_status")
    .eq("id", body.orderId)
    .maybeSingle();
  if (orderError) {
    console.error("Could not load order for access restoration:", orderError.message);
    return NextResponse.json({ error: "Impossible de vérifier cette commande." }, { status: 500 });
  }
  if (!order) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  if (order.payment_status !== "paid" || !order.user_id || !order.product_id) {
    return NextResponse.json({ error: "Seule une commande payée et associée à un compte peut restaurer un accès." }, { status: 409 });
  }

  try {
    await recordAdminAction(access.supabase, access.user.id, "order.access.restore", "order", order.id, "requested", {
      userId: order.user_id,
      productId: order.product_id,
    });
  } catch (caught) {
    return NextResponse.json({ error: caught instanceof Error ? caught.message : "Impossible d’enregistrer cette action." }, { status: 500 });
  }

  const { data: entitlement, error: entitlementLookupError } = await access.supabase
    .from("entitlements")
    .select("id, status")
    .eq("order_id", order.id)
    .maybeSingle();
  if (entitlementLookupError) {
    console.error("Could not check order entitlement:", entitlementLookupError.message);
    return NextResponse.json({ error: "Impossible de vérifier l’accès associé à la commande." }, { status: 500 });
  }
  if (entitlement?.status === "active") {
    return NextResponse.json({ error: "Cet accès est déjà actif." }, { status: 409 });
  }

  const now = new Date().toISOString();
  const write = entitlement
    ? await access.supabase
      .from("entitlements")
      .update({
        status: "active",
        granted_at: now,
        granted_by_user_id: access.user.id,
        revoked_at: null,
        revoke_reason: null,
      })
      .eq("id", entitlement.id)
      .select("id, status, granted_at")
      .single()
    : await access.supabase
      .from("entitlements")
      .insert({
        user_id: order.user_id,
        product_id: order.product_id,
        order_id: order.id,
        source: "payment",
        status: "active",
        granted_by_user_id: access.user.id,
      })
      .select("id, status, granted_at")
      .single();

  if (write.error) {
    console.error("Could not restore order entitlement:", write.error.message);
    return NextResponse.json({ error: "Impossible de rétablir cet accès." }, { status: 500 });
  }

  try {
    await recordAdminAction(access.supabase, access.user.id, "order.access.restore", "order", order.id, "completed", {
      entitlementId: write.data.id,
      userId: order.user_id,
      productId: order.product_id,
    });
  } catch (caught) {
    return NextResponse.json({ error: caught instanceof Error ? caught.message : "Le journal d’audit n’a pas pu confirmer l’action." }, { status: 500 });
  }

  return NextResponse.json({ entitlement: write.data }, { headers: { "Cache-Control": "private, no-store" } });
}
