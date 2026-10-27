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

  if (error || !access) {
    return (
      <main className="min-h-screen bg-[#0B1020] p-8 text-slate-100">
        <div className="mx-auto max-w-xl rounded-3xl border border-[#202E50] bg-[#151F38] p-8 text-center shadow-xl">
          <h1 className="text-2xl font-bold text-white">Accès non inclus</h1>
          <p className="mt-3 text-sm text-[#8F9CAE]">Ce skill nécessite un accès actif rattaché à votre compte.</p>
          <Link
            className="mt-6 inline-flex rounded-xl bg-gradient-to-r from-[#397BFF] to-[#6557FF] px-6 py-3 font-bold text-white shadow-md transition hover:brightness-110"
            href="/shop"
          >
            Voir le catalogue
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0B1020] px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <BackLink href={`/member/skills/${skillId}`}>Retour au skill</BackLink>

        <section className="relative mt-6 overflow-hidden rounded-3xl border border-[#202E50] bg-[#151F38] p-6 shadow-2xl sm:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-gradient-to-br from-[#397BFF]/25 to-[#6557FF]/20 blur-3xl"
          />

          <div className="relative z-10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#397BFF]">Votre espace personnel</p>
            <h1 className="mt-3 text-2xl font-black text-white sm:text-3xl">Construisez un agent à votre image</h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#8F9CAE]">
              Partagez des exemples qui reflètent votre ton, vos habitudes de réponse et votre façon d’échanger. Ils serviront de repères pour personnaliser votre agent, à votre rythme.
            </p>
            <p className="mt-4 text-xs leading-5 text-[#64748B]">
              Vos exemples restent dans votre espace privé. Évitez d’ajouter des informations confidentielles ou des échanges que vous n’êtes pas autorisé à partager.
            </p>
          </div>
        </section>

        <div className="mt-8">
          <AccountConversations />
        </div>
      </div>
    </main>
  );
}
