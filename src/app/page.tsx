import Link from "next/link";
import { products } from "@/features/products/products";

const sectors = [
  { number: "01", title: "Vente & marketing", detail: "Prospection, relation client, communication" },
  { number: "02", title: "Éducation & formation", detail: "Pédagogie, préparation, accompagnement" },
  { number: "03", title: "Commerce & services", detail: "Accueil, organisation, suivi des demandes" },
  { number: "04", title: "Création & contenu", detail: "Idées, rédaction, structuration" },
  { number: "05", title: "Entrepreneurs", detail: "Gestion quotidienne, offres, productivité" },
  { number: "06", title: "Métiers spécialisés", detail: "Des assistants adaptés à chaque contexte" },
];

export default function HomePage() {
  const firstProduct = products[0];

  return (
    <main className="overflow-hidden bg-[#0d1321] text-white">
      <section className="relative isolate">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_78%_30%,rgba(34,211,238,0.12),transparent_38%),radial-gradient(ellipse_at_20%_80%,rgba(59,130,246,0.10),transparent_40%)]" />
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 py-20 sm:px-6 md:py-28 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-32">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-1.5 text-xs font-semibold tracking-wide text-cyan-200">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
              Des skills IA pensés pour les métiers
            </p>
            <h1 className="mt-7 max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-0.045em] sm:text-6xl lg:text-[4.2rem]">
              Votre métier a ses défis.
              <span className="block bg-gradient-to-r from-cyan-200 to-blue-400 bg-clip-text text-transparent">
                Votre IA devrait le savoir.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
              SkillFlow crée des skills pratiques pour aider les assistants IA à mieux
              comprendre le travail réel — que vous soyez dans la vente, l’éducation,
              le commerce, la création ou un autre secteur.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="#secteurs" className="rounded-full bg-cyan-300 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200">
                Explorer les secteurs
              </Link>
              <Link href="/shop" className="rounded-full border border-slate-600 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/60 hover:text-cyan-100">
                Voir le catalogue
              </Link>
            </div>
            <p className="mt-5 text-xs leading-5 text-slate-500">
              Conçus pour Claude et ChatGPT · Guide d’utilisation inclus · Pack disponible
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-5 rounded-[2rem] bg-cyan-300/10 blur-3xl" />
            <div className="relative rounded-[1.6rem] border border-white/10 bg-[#111b2e]/90 p-5 shadow-[0_28px_100px_rgba(0,0,0,0.4)] sm:p-7">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">La méthode SkillFlow</p>
                  <p className="mt-1 text-sm font-semibold text-white">Du métier à l’assistant</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-lg text-cyan-200">✳</span>
              </div>
              <div className="space-y-3 py-5">
                {[
                  ["Le contexte", "Comprendre les besoins et les contraintes du métier"],
                  ["Le skill", "Transformer les bonnes pratiques en instructions claires"],
                  ["Le résultat", "Un assistant plus utile dans les tâches du quotidien"],
                ].map(([title, description], index) => (
                  <div key={title} className="flex gap-4 rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-300/10 text-xs font-bold text-cyan-200">
                      0{index + 1}
                    </span>
                    <div>
                      <h2 className="text-sm font-semibold text-white">{title}</h2>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="border-t border-white/[0.08] pt-4 text-xs text-slate-500">
                Un assistant généraliste. Des compétences adaptées à votre réalité.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="secteurs" className="border-y border-white/[0.07] bg-[#090f1b]/70">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Un skill pour chaque usage</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Plusieurs secteurs. Des besoins bien différents.
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-400 sm:text-base">
              Chaque domaine a ses méthodes, son vocabulaire et ses priorités.
              SkillFlow développe des compétences ciblées, plutôt qu’une solution unique pour tout le monde.
            </p>
          </div>

          <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sectors.map((sector) => (
              <article key={sector.number} className="group rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.035]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-[0.16em] text-cyan-300/80">{sector.number}</span>
                  <span className="h-px w-10 bg-slate-700 transition group-hover:w-14 group-hover:bg-cyan-300/50" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">{sector.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{sector.detail}</p>
              </article>
            ))}
          </div>
          <p className="mt-5 text-xs text-slate-500">
            Ces domaines illustrent les secteurs visés ; les skills sont publiés progressivement dans le catalogue.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Disponible maintenant</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            On commence par un besoin concret.
          </h2>
          <p className="mt-4 text-sm leading-6 text-slate-400">
            Le catalogue s’élargira à plusieurs domaines. Le premier pack aide à rendre
            la prospection plus claire, utile et respectueuse.
          </p>
          <Link href="/shop" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 transition hover:text-white">
            Parcourir le catalogue <span aria-hidden="true">→</span>
          </Link>
        </div>

        {firstProduct ? (
          <article className="rounded-2xl border border-cyan-300/15 bg-gradient-to-br from-[#142238] to-[#101827] p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="rounded-full border border-amber-300/20 bg-amber-300/[0.07] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-200">
                Disponible
              </span>
              <span className="text-xs text-slate-500">Vente & marketing</span>
            </div>
            <h3 className="mt-5 text-2xl font-semibold text-white">{firstProduct.name}</h3>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">{firstProduct.tagline}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {firstProduct.compatibleAgents.map((agent) => (
                <span key={agent} className="rounded-full border border-slate-700 bg-slate-950/30 px-3 py-1 text-xs text-slate-300">
                  {agent}
                </span>
              ))}
            </div>
            <Link href={`/products/${firstProduct.slug}`} className="mt-7 inline-flex rounded-full border border-cyan-300/25 px-5 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/10">
              Découvrir le premier pack
            </Link>
            <p className="mt-4 text-xs leading-5 text-slate-500">
              Achetez le pack et retrouvez son téléchargement sécurisé dans votre compte.
            </p>
          </article>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-sm text-slate-400">
            Les premiers skills seront bientôt présentés dans le catalogue.
          </div>
        )}
      </section>
    </main>
  );
}
