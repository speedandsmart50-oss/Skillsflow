import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/security/admin-api";

export async function GET(request: Request) {
  const access = await requireAdminApiUser(request);
  if (!access.ok) return access.response;

  const now = Date.now();
  const since7Days = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const since30Days = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [weekResult, monthResult] = await Promise.all([
    access.supabase.rpc("admin_dashboard_metrics", { p_since: since7Days }),
    access.supabase.rpc("admin_dashboard_metrics", { p_since: since30Days }),
  ]);

  const error = weekResult.error ?? monthResult.error;
  if (error) {
    console.error("Could not load admin dashboard metrics:", error.message);
    return NextResponse.json({ error: "Impossible de charger les indicateurs." }, { status: 500 });
  }

  return NextResponse.json({
    sevenDays: weekResult.data,
    thirtyDays: monthResult.data,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
