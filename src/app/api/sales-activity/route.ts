import { NextResponse } from "next/server";
import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RecentPaidSale = { product_name: string | null; product_slug: string | null; paid_at: string | null };

export async function GET() {
  await connection();

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return NextResponse.json({ sales: [] }, { headers: { "Cache-Control": "no-store" } });
    const supabase = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    });
    const { data, error } = await supabase.rpc("get_recent_paid_sales");

    if (error) {
      console.error("Could not load recent paid sales:", error.message);
      return NextResponse.json({ sales: [] }, { headers: { "Cache-Control": "no-store" } });
    }

    const sales = ((data ?? []) as RecentPaidSale[]).flatMap((sale) => {
      if (!sale.product_name || !sale.product_slug || !sale.paid_at) return [];
      return [{ id: `${sale.product_slug}-${sale.paid_at}`, productName: sale.product_name, productSlug: sale.product_slug, paidAt: sale.paid_at }];
    });

    return NextResponse.json({ sales }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=120" } });
  } catch {
    // Activity popups stay disabled if the public, data-minimized query is unavailable.
    return NextResponse.json({ sales: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}
