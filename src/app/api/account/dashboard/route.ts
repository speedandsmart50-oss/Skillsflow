import { NextResponse } from "next/server";
import { getAuthenticatedUser, getSupabaseUserClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Connectez-vous pour consulter votre espace." }, { status: 401 });
  }

  const supabase = getSupabaseUserClient(request);
  if (!supabase) {
    return NextResponse.json({ error: "Session expirée. Reconnectez-vous." }, { status: 401 });
  }
  const [ordersResult, entitlementsResult, keysResult, ticketsResult] = await Promise.all([
    supabase
      .from("orders")
      .select("id, total, total_xof, currency, coupon_code, payment_status, created_at, paid_at, products(name, slug)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("entitlements")
      .select("id, product_id, granted_at")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("granted_at", { ascending: false }),
    supabase
      .from("mcp_keys")
      .select("id, status, last_used_at, created_at, revoked_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("support_tickets")
      .select("id, category, subject, status, created_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const isMissingAccountTable = (error: { code?: string } | null) =>
    error?.code === "PGRST205" || error?.code === "42P01";
  const entitlements = isMissingAccountTable(entitlementsResult.error)
    ? []
    : entitlementsResult.data ?? [];
  const mcpKeys = isMissingAccountTable(keysResult.error) ? [] : keysResult.data ?? [];
  const tickets = isMissingAccountTable(ticketsResult.error) ? [] : ticketsResult.data ?? [];
  const queryError = ordersResult.error
    ?? (isMissingAccountTable(entitlementsResult.error) ? null : entitlementsResult.error)
    ?? (isMissingAccountTable(keysResult.error) ? null : keysResult.error)
    ?? (isMissingAccountTable(ticketsResult.error) ? null : ticketsResult.error);
  if (queryError) {
    console.error("Could not load account dashboard:", queryError.message);
    return NextResponse.json({ error: "Impossible de charger votre espace pour le moment." }, { status: 500 });
  }

  const productIds = [...new Set(entitlements.map((item) => item.product_id))];
  const [productsResult, versionsResult] = productIds.length
    ? await Promise.all([
      supabase
        .from("products")
        .select("id, slug, name, description, domain, catalog_status, version, zip_path")
        .in("id", productIds),
      supabase
        .from("skill_versions")
        .select("id, product_id, version, release_notes, claude_file_path, chatgpt_file_path, archive_path, created_at")
        .in("product_id", productIds)
        .eq("status", "published")
        .order("created_at", { ascending: false }),
    ])
    : [{ data: [], error: null }, { data: [], error: null }];

  const catalogError = productsResult.error ?? versionsResult.error;
  if (catalogError) {
    console.error("Could not load entitled skill details:", catalogError.message);
    return NextResponse.json({ error: "Impossible de charger vos skills." }, { status: 500 });
  }

  const productsById = new Map((productsResult.data ?? []).map((product) => [product.id, product]));
  const versionsByProduct = new Map<string, NonNullable<typeof versionsResult.data>[number]>();
  for (const version of versionsResult.data ?? []) {
    if (!versionsByProduct.has(version.product_id)) {
      versionsByProduct.set(version.product_id, version);
    }
  }

  const skills = entitlements.flatMap((entitlement) => {
    const product = productsById.get(entitlement.product_id);
    if (!product) return [];

    const version = versionsByProduct.get(product.id);
    return [{
      entitlementId: entitlement.id,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      domain: product.domain,
      grantedAt: entitlement.granted_at,
      version: version?.version ?? product.version,
      hasClaudeFile: Boolean(version?.claude_file_path),
      hasChatGptFile: Boolean(version?.chatgpt_file_path),
      hasArchive: Boolean(version?.archive_path ?? product.zip_path),
    }];
  });

  return NextResponse.json({
    user: { id: user.id, email: user.email ?? "" },
    orders: ordersResult.data ?? [],
    skills,
    mcpKeys,
    tickets,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
