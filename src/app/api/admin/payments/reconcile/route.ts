import { NextResponse } from "next/server";
import { activateSubscription } from "@/lib/payments/activation";
import { resolveSasPayTransaction, verifySasPayTransaction } from "@/lib/payments/saspay";
import { requireAdminApiUser } from "@/lib/security/admin-api";

function safeStatus(transaction: { status?: unknown; id?: unknown } | null) {
  return transaction ? {
    status: typeof transaction.status === "string" ? transaction.status : "unknown",
    transactionId: typeof transaction.id === "string" ? transaction.id : null,
  } : { status: "unknown", transactionId: null };
}

export async function GET(request: Request) {
  const access = await requireAdminApiUser(request);
  if (!access.ok) return access.response;
  const params = new URL(request.url).searchParams;
  const reference = params.get("reference")?.trim();
  const email = params.get("email")?.trim().toLowerCase();
  let query = access.supabase.from("orders")
    .select("id, user_id, product_id, order_reference, payment_status, total_xof, currency, provider_payment_id, provider_checkout_id, created_at, profiles(email), products(name, slug)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (reference) query = query.eq("order_reference", reference);
  else if (email) {
    const { data: profile, error: profileError } = await access.supabase.from("profiles")
      .select("id").eq("email", email).maybeSingle();
    if (profileError) return NextResponse.json({ error: "Impossible de rechercher ce compte." }, { status: 500 });
    if (!profile) return NextResponse.json({ orders: [], saspay: null });
    query = query.eq("user_id", profile.id);
  } else {
    query = query.eq("payment_status", "pending");
  }

  const { data: orders, error } = await query;
  if (error) {
    console.error("Could not load reconciliation orders:", error.message);
    return NextResponse.json({ error: "Impossible de charger les commandes." }, { status: 500 });
  }

  let remoteStatus = null;
  if (orders?.length === 1) {
    const order = orders[0];
    try {
      const transaction = order.provider_payment_id
        ? await verifySasPayTransaction(order.provider_payment_id)
        : order.provider_checkout_id
          ? await resolveSasPayTransaction(order.provider_checkout_id)
          : null;
      remoteStatus = safeStatus(transaction);
    } catch (caught) {
      remoteStatus = { status: "unavailable", error: caught instanceof Error ? caught.message : "SasPay indisponible" };
    }
  }
  return NextResponse.json({ orders: orders ?? [], saspay: remoteStatus }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: Request) {
  const access = await requireAdminApiUser(request);
  if (!access.ok) return access.response;
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 }); }
  if (!body || typeof body !== "object" || !("reference" in body)
    || typeof body.reference !== "string" || !body.reference.trim()) {
    return NextResponse.json({ error: "Saisissez une référence de commande." }, { status: 400 });
  }

  const { data: order, error: orderError } = await access.supabase.from("orders")
    .select("id, order_reference")
    .eq("order_reference", body.reference.trim())
    .maybeSingle();
  if (orderError) return NextResponse.json({ error: "Impossible de vérifier la commande." }, { status: 500 });
  if (!order) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });

  try {
    const result = await activateSubscription(order.id, "manual");
    const { error: logError } = await access.supabase.from("payment_reconciliation_logs").insert({
      order_id: order.id,
      order_reference: order.order_reference,
      source: "manual",
      action: result.activated ? (result.alreadyPaid ? "already_paid" : "activated") : result.reason,
      detail: result.activated ? null : result.reason,
    });
    if (logError) console.error("Could not record manual reconciliation:", logError.message);
    if (!result.activated) {
      return NextResponse.json({ activated: false, status: result.reason }, { status: 409 });
    }
    return NextResponse.json({ activated: true, alreadyPaid: result.alreadyPaid, status: "paid" }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Erreur de vérification SasPay.";
    const { error: logError } = await access.supabase.from("payment_reconciliation_logs").insert({
      order_id: order.id, order_reference: order.order_reference, source: "manual", action: "error", detail: message.slice(0, 500),
    });
    if (logError) console.error("Could not record manual reconciliation error:", logError.message);
    return NextResponse.json({ error: "La vérification SasPay a échoué. Aucun accès n'a été forcé." }, { status: 502 });
  }
}
