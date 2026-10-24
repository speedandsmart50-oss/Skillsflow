import Link from "next/link";
import { requirePageUser } from "@/lib/security/page-auth";
import { connection } from "next/server";
import { getSupabaseSessionClient } from "@/lib/supabase/browser-server";
import { AccountConversations } from "@/components/account-conversations";

export const instant = false;
export default async function SkillAgent({ params }: { params: Promise<{ skillId: string }> }) {
  const { skillId } = await params;
  await connection();
  const user = await requirePageUser(`/member/skills/${skillId}/agent`);
  const supabase = await getSupabaseSessionClient();
  const { data: access, error } = await supabase.rpc("can_access_skill", { p_user_id: user.id, p_skill_id: skillId });
  if (error || !access) return <main className="min-h-screen bg-[#0b1020] p-8 text-slate-100"><h1 className="text-2xl font-semibold">Accès non inclus</h1><p className="mt-3 text-slate-300">Ce skill nécessite un accès actif dans votre compte.</p><Link className="mt-5 inline-flex rounded-full bg-cyan-300 px-5 py-3 font-bold text-slate-950" href="/shop">Voir le catalogue</Link></main>;
  return <main className="min-h-screen bg-[#0b1020] px-4 py-8 text-slate-100 sm:px-8"><div className="mx-auto max-w-5xl"><Link className="text-cyan-200" href={`/member/skills/${skillId}`}>← Configuration du skill</Link><section className="mt-6 rounded-3xl border border-amber-200/20 bg-amber-200/[.06] p-5"><h1 className="text-2xl font-semibold">Agent IA personnalisé</h1><p className="mt-2 text-sm leading-6 text-slate-300">Vos exemples et captures sont enregistrés de façon privée. L’analyse automatique et le chat attendent la configuration d’un fournisseur IA et d’un OCR; aucun contenu ne sera envoyé à un service externe sans activation explicite.</p></section><div className="mt-7"><AccountConversations /></div></div></main>;
}
