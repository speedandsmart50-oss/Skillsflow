import { NextResponse } from "next/server";
import { getAuthenticatedUser, getSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Connectez-vous pour exporter vos données." }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  const [profileResult, ordersResult, entitlementsResult, downloadsResult, keysResult, ticketsResult, conversationsResult, waitlistResult] = await Promise.all([
    supabase.from("profiles").select("id, email, role, created_at").eq("id", user.id).maybeSingle(),
    supabase.from("orders").select("id, order_reference, total, total_xof, currency, payment_status, coupon_code, created_at, paid_at, product_id").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("entitlements").select("id, product_id, source, status, granted_at, revoked_at").eq("user_id", user.id).order("granted_at", { ascending: false }),
    supabase.from("downloads").select("id, product_id, version, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("mcp_keys").select("id, status, last_used_at, created_at, revoked_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("support_tickets").select("id, order_id, category, subject, message, status, created_at, updated_at, resolved_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("agent_conversations").select("id, title, conversation_text, screenshot_paths, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    user.email
      ? supabase.from("waitlist")
        .select("id, email, status, source, created_at")
        .ilike("email", user.email.replace(/[\\%_]/g, "\\$&"))
        .limit(1)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const error = profileResult.error
    ?? ordersResult.error
    ?? entitlementsResult.error
    ?? downloadsResult.error
    ?? keysResult.error
    ?? ticketsResult.error
    ?? conversationsResult.error
    ?? waitlistResult.error;
  if (error) {
    console.error("Could not export account data:", error.message);
    return NextResponse.json({ error: "Impossible de préparer votre export." }, { status: 500 });
  }

  const exportData = {
    exportedAt: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email ?? null,
      createdAt: user.created_at,
      profile: profileResult.data,
      metadata: user.user_metadata,
    },
    orders: ordersResult.data ?? [],
    entitlements: entitlementsResult.data ?? [],
    downloads: downloadsResult.data ?? [],
    mcpKeys: keysResult.data ?? [],
    supportTickets: ticketsResult.data ?? [],
    agentConversations: conversationsResult.data ?? [],
    waitlistEntries: waitlistResult.data ?? [],
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="skillflow-donnees-${user.id}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
