import { BackLink } from "@/components/back-link";
import { requirePageUser } from "@/lib/security/page-auth";
import { connection } from "next/server";

export const instant = false;

export default async function MemberJarvisflowPage() {
  await connection();
  await requirePageUser("/member/jarvisflow");

  return (
    <main className="min-h-screen bg-[#0B1020] px-4 py-8 text-slate-100 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <BackLink href="/account">Retour à mon espace</BackLink>

        <section className="relative mt-6 overflow-hidden rounded-3xl border border-[#202E50] bg-[#151F38] p-6 shadow-2xl sm:p-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-16 h-80 w-80 rounded-full bg-gradient-to-br from-[#20DDF2]/20 to-[#6557FF]/20 blur-3xl"
          />
          <div className="relative z-10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#20DDF2]">Votre espace de travail IA</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">Jarvisflow</h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#8F9CAE] sm:text-lg">
              C’est ici que votre projet Jarvis prendra forme. Retrouvez prochainement dans cet espace les étapes, les ressources et le suivi de la construction de votre assistant personnel.
            </p>
            <p className="mt-8 inline-flex items-center gap-2 rounded-full border border-[#20DDF2]/20 bg-[#20DDF2]/[.06] px-4 py-2 text-sm font-semibold text-[#B8EAF0]">
              <span aria-hidden="true" className="text-[#20DDF2]">✦</span>
              Espace Jarvis en préparation
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
