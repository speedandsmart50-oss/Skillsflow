import { BackLink } from "@/components/back-link";
import { connection } from "next/server";
import { requirePageUser } from "@/lib/security/page-auth";
import { ProspectionPipeline } from "@/components/prospection-pipeline";

export const instant = false;

const modules = [
  ["01", "Leads", "Retrouvez et organisez vos contacts, leurs sources et les prochaines étapes.", "◎"],
  ["02", "Pipelines", "Visualisez les étapes de vos conversations et gardez le suivi au même endroit.", "▥"],
  ["03", "Vidéos", "Accédez aux vidéos de présentation et aux supports associés à vos échanges.", "▷"],
  ["04", "Formations", "Retrouvez les ressources de formation liées à votre activité de prospection.", "⌘"],
  ["05", "Statistiques", "Consultez vos indicateurs d’activité et suivez vos pipelines.", "↗"],
];

export default async function MemberProspectionPage() {
  await connection();
  await requirePageUser("/member/prospection");

  return (
    <main className="min-h-screen bg-[#0B1020] px-4 py-8 text-slate-100 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <BackLink href="/account">Retour à mon espace</BackLink>

        {/* Hero Section */}
        <section className="relative mt-6 overflow-hidden rounded-3xl border border-[#202E50] bg-[#151F38] p-6 shadow-2xl sm:p-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-16 h-80 w-80 rounded-full bg-gradient-to-br from-[#397BFF]/25 to-[#6557FF]/20 blur-3xl"
          />

          <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#397BFF]">Espace SkillFlow</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">SkillFlow Prospection</h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#8F9CAE] sm:text-lg">
                Votre espace de suivi commercial : contacts, pipelines, vidéos, formations et statistiques, réunis au même endroit.
              </p>
            </div>

            <div className="rounded-2xl border border-[#20DDF2]/20 bg-[#20DDF2]/[.06] px-5 py-4 text-sm text-[#B8EAF0] lg:max-w-xs">
              <p className="font-bold text-white">Votre pipeline est intégré à Skillsflow.</p>
              <p className="mt-1 leading-5 text-[#8FBDCA]">Gérez vos contacts et vos prochaines actions sans changer d’espace.</p>
            </div>
          </div>

          <p className="relative mt-8 border-t border-[#202E50] pt-4 text-xs leading-5 text-[#8F9CAE]">
            Un espace de travail Skillsflow pour organiser vos conversations avec clarté, dans le respect du consentement et du rythme de chaque contact.
          </p>
        </section>

        <ProspectionPipeline />

        {/* Modules Grid */}
        <section className="mt-12 sm:mt-16" aria-labelledby="prospection-modules">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00E5FF]">Votre boîte à outils</p>
              <h2 id="prospection-modules" className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
                Un espace pour garder le cap
              </h2>
            </div>
            <p className="max-w-lg text-sm text-[#8F9CAE]">Le pipeline est disponible directement ici. Les prochains modules viendront compléter votre espace de suivi.</p>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map(([number, title, description, icon]) => (
              <article
                key={number}
                className="group flex flex-col justify-between rounded-2xl border border-[#202E50] bg-[#151F38] p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-[#397BFF]/50"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <span
                      aria-hidden="true"
                      className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#397BFF]/30 bg-[#397BFF]/10 text-xl font-bold text-[#8FB5FF] transition group-hover:scale-105"
                    >
                      {icon}
                    </span>
                    <span className="font-mono text-xs font-bold tracking-widest text-[#64748B]">{number}</span>
                  </div>

                  <h3 className="mt-5 text-xl font-bold text-white group-hover:text-[#8FB5FF] transition">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#8F9CAE]">{description}</p>
                </div>

                <div className="mt-6 border-t border-[#202E50] pt-4">
                  <span className="text-xs font-semibold text-[#00E5FF]">Bientôt dans Skillsflow</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
