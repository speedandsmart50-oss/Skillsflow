import Link from "next/link";
import { AnimatedShowcase } from "@/components/landing/animated-showcase";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { products as bundledProducts } from "@/features/products/products";
import { canCheckout } from "@/lib/commerce";

const steps = [
  {
    number: "01",
    title: "Choisissez un skill",
    description: "Partez d’un besoin concret et consultez le contenu, la compatibilité et les formats proposés.",
  },
  {
    number: "02",
    title: "Ajoutez-le à votre assistant",
    description: "Suivez le guide fourni pour utiliser les instructions avec les outils compatibles.",
  },
  {
    number: "03",
    title: "Travaillez avec votre contexte",
    description: "Votre assistant s’appuie sur des consignes ciblées pour vous aider dans vos tâches.",
  },
];

const benefits = [
  { mark: "01", title: "Un usage précis", text: "Des instructions conçues autour d’une tâche ou d’un métier." },
  { mark: "02", title: "Des formats pratiques", text: "Des fichiers et un guide pour faciliter la prise en main." },
  { mark: "03", title: "Connexion MCP", text: "Après l’achat, reliez votre clé personnelle à votre client MCP pour retrouver le pack." },
];

export default function HomePage() {
  const featuredProduct = bundledProducts.find((product) => product.catalogStatus === "disponible") ?? bundledProducts[0];
  const salesEnabled = canCheckout(process.env.SKILLFLOW_COMMERCE_ENABLED);

  return (
    <main className="overflow-hidden bg-[#0b1020] text-white">
      <section className="relative isolate">
        <div className="hero-grid pointer-events-none absolute inset-0 -z-20 opacity-40" />
        <div className="pointer-events-none absolute -right-40 -top-32 -z-10 h-[34rem] w-[34rem] rounded-full bg-cyan-400/10 blur-[110px]" />
        <div className="pointer-events-none absolute -bottom-40 -left-40 -z-10 h-[30rem] w-[30rem] rounded-full bg-violet-500/10 blur-[110px]" />

        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-16 sm:px-8 sm:pb-24 sm:pt-20 lg:grid-cols-[1.03fr_0.97fr] lg:gap-16 lg:px-10 lg:pb-32 lg:pt-28">
          <div className="animate-rise relative z-10">
            <div className="inline-flex items-center gap-2.5 rounded-full border border-cyan-300/20 bg-cyan-300/[0.07] px-3.5 py-2 text-xs font-semibold text-cyan-100 shadow-[0_0_28px_rgba(34,211,238,0.08)] sm:text-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-300" />
              </span>
              Des skills IA pour le travail réel
            </div>

            <h1 className="mt-7 max-w-3xl font-[family-name:var(--font-bricolage)] text-[2.8rem] font-semibold leading-[1.02] tracking-[-0.055em] sm:text-6xl lg:text-[4.4rem]">
              Donnez à votre IA les bons
              <span className="hero-gradient block pb-2">réflexes métier.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
              Des compétences prêtes à l’emploi qui aident votre assistant à mieux comprendre
              vos méthodes, vos objectifs et les tâches que vous voulez accomplir.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/shop"
                className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-cyan-300 px-6 py-3 text-sm font-bold text-[#07111e] shadow-[0_8px_34px_rgba(34,211,238,0.2)] transition duration-300 hover:-translate-y-0.5 hover:bg-cyan-200 hover:shadow-[0_12px_42px_rgba(34,211,238,0.3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200"
              >
                Explorer les skills
                <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </Link>
              <Link
                href="#comment-ca-marche"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-200/40 hover:bg-white/[0.04] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200"
              >
                Comment ça marche
              </Link>
            </div>

            <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-slate-400 sm:text-sm">
              <span className="inline-flex items-center gap-2"><span className="text-cyan-300">✓</span> Des instructions ciblées</span>
              <span className="hidden h-1 w-1 rounded-full bg-slate-600 sm:block" />
              <span className="inline-flex items-center gap-2"><span className="text-cyan-300">✓</span> Des guides d’installation</span>
            </div>
          </div>

          <AnimatedShowcase />
        </div>
      </section>

      <ScrollReveal>
      <section className="border-y border-white/[0.07] bg-white/[0.02]">
        <div className="mx-auto grid max-w-7xl gap-4 px-5 py-6 sm:grid-cols-3 sm:px-8 lg:px-10">
          {benefits.map((benefit) => (
            <div key={benefit.mark} className="flex items-start gap-3 rounded-xl px-2 py-2 sm:px-4">
              <span className="mt-0.5 font-mono text-xs font-semibold text-cyan-300">{benefit.mark}</span>
              <div>
                <h2 className="text-sm font-semibold text-slate-100">{benefit.title}</h2>
                <p className="mt-1 text-xs leading-5 text-slate-400">{benefit.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      </ScrollReveal>

      <ScrollReveal>
      <section id="comment-ca-marche" className="scroll-mt-24">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-10 lg:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">Simple à prendre en main</p>
            <h2 className="mt-4 font-[family-name:var(--font-bricolage)] text-3xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
              Du besoin à l’usage, en trois étapes.
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-400 sm:text-base sm:leading-7">
              Chaque fiche vous aide à savoir à quoi sert le skill, quels outils il prend en charge et comment commencer.
            </p>
          </div>

          <div className="relative mt-12 grid gap-4 md:grid-cols-3 md:gap-5">
            <div className="absolute left-[16%] right-[16%] top-8 hidden h-px bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent md:block" />
            {steps.map((step, index) => (
              <article key={step.number} className="animate-rise group relative rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.045] to-white/[0.015] p-6 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/25 hover:bg-cyan-300/[0.035] sm:p-7" style={{ animationDelay: `${index * 0.1}s` }}>
                <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-[#111b2c] font-mono text-sm font-bold text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.1)]">{step.number}</span>
                <h3 className="mt-6 text-lg font-semibold text-white">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      </ScrollReveal>

      <ScrollReveal>
      <section className="border-y border-white/[0.07] bg-[#080d18]">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:px-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">Le catalogue SkillFlow</p>
            <h2 className="mt-4 font-[family-name:var(--font-bricolage)] text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
              Des solutions ciblées, pas des réponses génériques.
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-6 text-slate-400 sm:text-base sm:leading-7">
              Explorez les compétences disponibles et choisissez celle qui correspond à votre façon de travailler.
              Le catalogue évolue au fil des nouveaux besoins traités.
            </p>
            <Link href="/shop" className="group mt-7 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 transition hover:text-white">
              Parcourir le catalogue <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </div>

          {featuredProduct ? (
            <article className="relative overflow-hidden rounded-[1.6rem] border border-cyan-300/15 bg-gradient-to-br from-[#14233a] via-[#101a2d] to-[#111827] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.25)] sm:p-8">
              <div className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-cyan-300/10 blur-3xl" />
              <div className="relative flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/[0.07] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                  {salesEnabled ? "Disponible" : "Dans le catalogue"}
                </span>
                <span className="text-xs text-slate-500">{featuredProduct.domain} · v{featuredProduct.version}</span>
              </div>
              <div className="relative mt-6 flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-violet-300/15 bg-violet-300/[0.08] text-lg text-violet-200">✳</span>
                <div>
                  <h3 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{featuredProduct.name}</h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">{featuredProduct.tagline}</p>
                </div>
              </div>
              <div className="relative mt-6 flex flex-wrap gap-2">
                <span className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs font-medium text-slate-300">Pack numérique</span>
              </div>
              <div className="relative mt-7 flex flex-col gap-4 border-t border-white/[0.08] pt-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs text-slate-500">Prix du pack</p>
                  <p className="mt-1 text-xl font-semibold text-white">€{featuredProduct.price.toFixed(2)} <span className="text-sm font-medium text-slate-400">· {new Intl.NumberFormat("fr-FR").format(featuredProduct.priceXof)} XOF</span></p>
                </div>
                <Link href={`/products/${featuredProduct.slug}`} className="group inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-cyan-300 px-5 py-2.5 text-sm font-bold text-[#07111e] transition hover:-translate-y-0.5 hover:bg-cyan-200">
                  Découvrir le skill <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
                </Link>
              </div>
            </article>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-8 text-sm text-slate-400">
              Le catalogue se prépare. Revenez bientôt découvrir les premiers skills.
            </div>
          )}
        </div>
      </section>
      </ScrollReveal>

      <ScrollReveal>
      <section className="px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[1.75rem] border border-cyan-300/15 bg-gradient-to-r from-[#13233a] via-[#111b2d] to-[#18152c] px-6 py-10 sm:px-10 sm:py-12 lg:px-14">
          <div className="pointer-events-none absolute -right-10 -top-28 h-72 w-72 rounded-full bg-cyan-300/10 blur-[80px]" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">À vous de choisir</p>
              <h2 className="mt-3 font-[family-name:var(--font-bricolage)] text-2xl font-semibold tracking-[-0.035em] text-white sm:text-3xl">
                Trouvez le skill qui vous fait gagner en clarté.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">Parcourez les fiches, comparez les usages et avancez à votre rythme.</p>
            </div>
            <Link href="/shop" className="group inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-100">
              Voir les skills <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </div>
        </div>
      </section>
      </ScrollReveal>
    </main>
  );
}
