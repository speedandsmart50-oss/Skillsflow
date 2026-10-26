import Link from "next/link";
import { BackLink } from "@/components/back-link";
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
  return <main className="min-h-screen bg-[#0b1020] px-4 py-8 text-slate-100 sm:px-8"><div className="mx-auto max-w-5xl"><BackLink href={`/member/skills/${skillId}`}>Retour</BackLink><section className="mt-6 rounded-3xl border border-cyan-200/20 bg-gradient-to-br from-cyan-300/[.12] via-[#111b2d] to-violet-300/[.08] p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Votre espace personnel</p><h1 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">Construisez un agent à votre image</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">Partagez des exemples qui reflètent votre ton, vos habitudes de réponse et votre façon d’échanger. Ils serviront de repères pour personnaliser votre agent, à votre rythme.</p><p className="mt-3 text-xs leading-5 text-slate-400">Vos exemples restent dans votre espace privé. Évitez d’ajouter des informations confidentielles ou des échanges que vous n’êtes pas autorisé à partager.</p></section><div className="mt-8"><AccountConversations /></div></div></main>;
}
