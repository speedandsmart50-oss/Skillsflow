import { NextResponse } from "next/server";
import { recordAdminAction, requireAdminApiUser } from "@/lib/security/admin-api";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request: Request) {
  const access = await requireAdminApiUser(request);
  if (!access.ok) return access.response;

  const search = new URL(request.url).searchParams.get("search")?.trim() ?? "";
  if (search.length > 100) {
    return NextResponse.json({ error: "La recherche est trop longue." }, { status: 400 });
  }

  let profilesQuery = access.supabase
    .from("profiles")
    .select("id, email, role, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (search) profilesQuery = profilesQuery.ilike("email", `%${search}%`);

  const { data: profiles, error } = await profilesQuery;
  if (error) {
    console.error("Could not search admin customers:", error.message);
    return NextResponse.json({ error: "Impossible de rechercher les clients." }, { status: 500 });
  }

  const userIds = (profiles ?? []).map((profile) => profile.id);
  const [ordersResult, entitlementsResult] = userIds.length
    ? await Promise.all([
      access.supabase
        .from("orders")
        .select("id, user_id, product_id, total, total_xof, currency, payment_status, created_at, paid_at, products(name, slug)")
        .in("user_id", userIds)
        .order("created_at", { ascending: false })
        .limit(1000),
      access.supabase
        .from("entitlements")
        .select("id, user_id, product_id, order_id, source, status, granted_at, revoked_at, products(name, slug)")
        .in("user_id", userIds)
        .order("granted_at", { ascending: false })
        .limit(1000),
    ])
    : [{ data: [], error: null }, { data: [], error: null }];

  const queryError = ordersResult.error ?? entitlementsResult.error;
  if (queryError) {
    console.error("Could not load customer history:", queryError.message);
    return NextResponse.json({ error: "Impossible de charger l’historique des clients." }, { status: 500 });
  }

  return NextResponse.json({
    customers: (profiles ?? []).map((profile) => ({
      ...profile,
      orders: (ordersResult.data ?? []).filter((order) => order.user_id === profile.id),
      entitlements: (entitlementsResult.data ?? []).filter((item) => item.user_id === profile.id),
    })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const access = await requireAdminApiUser(request);
  if (!access.ok) return access.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "La demande est invalide." }, { status: 400 });
  }

  if (!isRecord(body) || !["grant", "revoke", "impersonate"].includes(String(body.action))) {
    return NextResponse.json({ error: "Action d’accès invalide." }, { status: 400 });
  }

  if (body.action === "impersonate") {
    if (typeof body.userId !== "string" || !UUID_PATTERN.test(body.userId)) {
      return NextResponse.json({ error: "Sélectionnez un client valide." }, { status: 400 });
    }

    const { data: target, error: targetError } = await access.supabase
      .from("profiles")
      .select("id, email, role")
      .eq("id", body.userId)
      .maybeSingle();
    if (targetError) {
      console.error("Could not load impersonation target:", targetError.message);
      return NextResponse.json({ error: "Impossible de charger ce client." }, { status: 500 });
    }
    if (!target || target.role !== "client") {
      return NextResponse.json({ error: "Seuls les comptes clients peuvent être ouverts depuis l’administration." }, { status: 404 });
    }

    try {
      await recordAdminAction(access.supabase, access.user.id, "customer.impersonation.start", "profile", target.id, "requested", {
        targetEmail: target.email,
      });
    } catch (caught) {
      return NextResponse.json({ error: caught instanceof Error ? caught.message : "Impossible d’enregistrer cette action." }, { status: 500 });
    }

    const origin = new URL(request.url).origin;
    const { data: link, error: linkError } = await getSupabaseAdminClient().auth.admin.generateLink({
      type: "magiclink",
      email: target.email,
      options: { redirectTo: `${origin}/account` },
    });
    if (linkError || !link?.properties?.action_link) {
      console.error("Could not generate customer impersonation link:", linkError?.message);
      return NextResponse.json({ error: "Impossible de générer la connexion client." }, { status: 500 });
    }

    try {
      await recordAdminAction(access.supabase, access.user.id, "customer.impersonation.start", "profile", target.id, "completed", {
        targetEmail: target.email,
      });
    } catch (caught) {
      return NextResponse.json({ error: caught instanceof Error ? caught.message : "Le journal d’audit n’a pas pu confirmer l’action." }, { status: 500 });
    }

    return NextResponse.json({ actionLink: link.properties.action_link }, { headers: { "Cache-Control": "no-store" } });
  }

  if (body.action === "grant") {
    if (
      typeof body.userId !== "string"
      || !UUID_PATTERN.test(body.userId)
      || typeof body.productId !== "string"
      || !UUID_PATTERN.test(body.productId)
    ) {
      return NextResponse.json({ error: "Sélectionnez un client et un skill valides." }, { status: 400 });
    }

    const [profileResult, productResult] = await Promise.all([
      access.supabase.from("profiles").select("id").eq("id", body.userId).maybeSingle(),
      access.supabase.from("products").select("id, archived_at").eq("id", body.productId).maybeSingle(),
    ]);
    if (profileResult.error || productResult.error) {
      console.error("Could not verify manual access targets:", profileResult.error?.message ?? productResult.error?.message);
      return NextResponse.json({ error: "Impossible de vérifier le client ou le skill." }, { status: 500 });
    }
    if (!profileResult.data || !productResult.data || productResult.data.archived_at) {
      return NextResponse.json({ error: "Le client ou le skill est introuvable ou archivé." }, { status: 404 });
    }

    const { data: existing, error: existingError } = await access.supabase
      .from("entitlements")
      .select("id, status")
      .eq("user_id", body.userId)
      .eq("product_id", body.productId)
      .eq("status", "active")
      .maybeSingle();
    if (existingError) {
      console.error("Could not check existing customer access:", existingError.message);
      return NextResponse.json({ error: "Impossible de vérifier les accès actuels." }, { status: 500 });
    }
    if (existing) return NextResponse.json({ error: "Ce client a déjà accès à ce skill." }, { status: 409 });

    try {
      await recordAdminAction(access.supabase, access.user.id, "customer.entitlement.grant", "entitlement", null, "requested", {
        userId: body.userId,
        productId: body.productId,
      });
    } catch (caught) {
      return NextResponse.json({ error: caught instanceof Error ? caught.message : "Impossible d’enregistrer cette action." }, { status: 500 });
    }

    const { data: entitlement, error } = await access.supabase
      .from("entitlements")
      .insert({
        user_id: body.userId,
        product_id: body.productId,
        source: "manual",
        status: "active",
        granted_by_user_id: access.user.id,
      })
      .select("id, user_id, product_id, status, granted_at")
      .single();
    if (error) {
      console.error("Could not grant manual customer access:", error.message);
      return NextResponse.json({ error: "Impossible d’accorder cet accès." }, { status: 500 });
    }

    try {
      await recordAdminAction(access.supabase, access.user.id, "customer.entitlement.grant", "entitlement", entitlement.id, "completed", {
        userId: body.userId,
        productId: body.productId,
      });
    } catch (caught) {
      return NextResponse.json({ error: caught instanceof Error ? caught.message : "Le journal d’audit n’a pas pu confirmer l’action." }, { status: 500 });
    }
    return NextResponse.json({ entitlement }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  }

  if (
    typeof body.entitlementId !== "string"
    || !UUID_PATTERN.test(body.entitlementId)
    || body.confirmation !== "RETIRER"
  ) {
    return NextResponse.json({ error: "Confirmez le retrait de l’accès." }, { status: 400 });
  }

  const { data: existing, error: lookupError } = await access.supabase
    .from("entitlements")
    .select("id, user_id, product_id, status")
    .eq("id", body.entitlementId)
    .maybeSingle();
  if (lookupError) {
    console.error("Could not load entitlement for revocation:", lookupError.message);
    return NextResponse.json({ error: "Impossible de vérifier cet accès." }, { status: 500 });
  }
  if (!existing) return NextResponse.json({ error: "Accès introuvable." }, { status: 404 });
  if (existing.status === "revoked") return NextResponse.json({ error: "Cet accès est déjà retiré." }, { status: 409 });

  try {
    await recordAdminAction(access.supabase, access.user.id, "customer.entitlement.revoke", "entitlement", existing.id, "requested", {
      userId: existing.user_id,
      productId: existing.product_id,
    });
  } catch (caught) {
    return NextResponse.json({ error: caught instanceof Error ? caught.message : "Impossible d’enregistrer cette action." }, { status: 500 });
  }

  const { error } = await access.supabase
    .from("entitlements")
    .update({ status: "revoked", revoked_at: new Date().toISOString(), revoke_reason: "Retiré par un administrateur." })
    .eq("id", existing.id);
  if (error) {
    console.error("Could not revoke customer entitlement:", error.message);
    return NextResponse.json({ error: "Impossible de retirer cet accès." }, { status: 500 });
  }

  try {
    await recordAdminAction(access.supabase, access.user.id, "customer.entitlement.revoke", "entitlement", existing.id, "completed", {
      userId: existing.user_id,
      productId: existing.product_id,
    });
  } catch (caught) {
    return NextResponse.json({ error: caught instanceof Error ? caught.message : "Le journal d’audit n’a pas pu confirmer l’action." }, { status: 500 });
  }
  return NextResponse.json({ revoked: true });
}
