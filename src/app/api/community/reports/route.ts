import { NextResponse } from "next/server";
import { getCommunitySession } from "@/lib/community/server";

async function isStaff(context: NonNullable<Awaited<ReturnType<typeof getCommunitySession>>>) {
  const [{ data: profile }, { data: role }] = await Promise.all([
    context.supabase.from("profiles").select("role").eq("id", context.user.id).maybeSingle(),
    context.supabase.from("community_staff").select("staff_role").eq("user_id", context.user.id).maybeSingle(),
  ]);
  return profile?.role === "admin" || Boolean(role);
}

export async function GET() {
  const context = await getCommunitySession();
  if (!context) return NextResponse.json({ error: "Connectez-vous pour consulter les signalements." }, { status: 401 });
  if (!await isStaff(context)) return NextResponse.json({ error: "Cette page est réservée à l’équipe." }, { status: 403 });

  const { data, error } = await context.supabase.from("reports")
    .select("id, reason, status, created_at, message_id, messages(id, channel_id, author_id, content, created_at, community_members(display_name))")
    .eq("status", "open")
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) {
    console.error("Could not load community reports:", error.message);
    return NextResponse.json({ error: "Impossible de charger les signalements." }, { status: 503 });
  }
  return NextResponse.json({ reports: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}
