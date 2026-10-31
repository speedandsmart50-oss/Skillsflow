import { connection } from "next/server";
import { MyCommunities } from "@/components/community/my-communities";
import { BackLink } from "@/components/back-link";
import { requirePageUser } from "@/lib/security/page-auth";
import { getSupabaseSessionClient } from "@/lib/supabase/browser-server";

export const instant = false;

export default async function MyCommunitiesPage() {
  await connection();
  const user = await requirePageUser("/community/my");
  const supabase = await getSupabaseSessionClient();
  const { data: subscription } = await supabase.from("member_subscriptions").select("id").eq("user_id", user.id).eq("status", "active").gt("ends_at", new Date().toISOString()).limit(1).maybeSingle();
  if (!subscription) {
    return <main className="mx-auto max-w-2xl px-4 py-10"><BackLink href="/account">Retour à la vue d’ensemble</BackLink><section className="mt-6 rounded-2xl border border-cyan-300/20 bg-[#0B1729] p-7 text-white shadow-xl"><p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-200">Espace réservé aux membres</p><h1 className="mt-3 text-3xl font-bold">Ma communauté</h1><p className="mt-3 leading-7 text-slate-300">Cette partie est réservée aux membres ayant un abonnement actif. La communauté générale reste accessible gratuitement.</p><BackLink href="/account?section=subscription" className="mt-6">Voir les abonnements</BackLink></section></main>;
  }
  return <MyCommunities />;
}
