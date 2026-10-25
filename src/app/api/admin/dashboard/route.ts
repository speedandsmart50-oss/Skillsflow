import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/security/admin-api";

export async function GET(request: Request) {
  const access = await requireAdminApiUser(request);
  if (!access.ok) return access.response;

  const now = Date.now();
  const since7Days = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const since30Days = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [weekResult, monthResult, ordersResult, recentPaidResult] = await Promise.all([
    access.supabase.rpc("admin_dashboard_metrics", { p_since: since7Days }),
    access.supabase.rpc("admin_dashboard_metrics", { p_since: since30Days }),
    access.supabase
      .from("orders")
      .select("id, user_id, product_id, total, total_xof, currency, coupon_code, payment_status, created_at, paid_at, profiles(email), products(name, slug)")
      .order("created_at", { ascending: false })
      .limit(6),
    access.supabase
      .from("orders")
      .select("paid_at, total_xof")
      .eq("payment_status", "paid")
      .gte("paid_at", since30Days)
      .order("paid_at", { ascending: true })
      .limit(5000),
  ]);

  const error = weekResult.error ?? monthResult.error ?? ordersResult.error ?? recentPaidResult.error;
  if (error) {
    console.error("Could not load admin dashboard metrics:", error.message);
    return NextResponse.json({ error: "Impossible de charger les indicateurs." }, { status: 500 });
  }

  const makeBuckets = (count: number) => Array.from({ length: count }, (_, index) => {
    const day = new Date(now - (count - 1 - index) * 24 * 60 * 60 * 1000);
    day.setUTCHours(0, 0, 0, 0);
    return { date: day.toISOString().slice(0, 10), revenue_xof: 0, sales: 0 };
  });
  const revenueByDay = makeBuckets(7);
  const revenueByDay30 = makeBuckets(30);
  for (const order of recentPaidResult.data ?? []) {
    if (!order.paid_at) continue;
    const date = new Date(order.paid_at).toISOString().slice(0, 10);
    for (const buckets of [revenueByDay, revenueByDay30]) {
      const bucket = buckets.find((item) => item.date === date);
      if (bucket) {
        bucket.revenue_xof += Number(order.total_xof ?? 0);
        bucket.sales += 1;
      }
    }
  }

  return NextResponse.json({
    sevenDays: weekResult.data,
    thirtyDays: monthResult.data,
    recentOrders: ordersResult.data,
    revenueByDay,
    revenueByDay30,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
