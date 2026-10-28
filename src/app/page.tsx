import Link from "next/link";
import { AnimatedShowcase } from "@/components/landing/animated-showcase";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { products as bundledProducts } from "@/features/products/products";
import { canCheckout } from "@/lib/commerce";
import { PricingGrid } from "@/components/pricing-grid";
import { getCatalogProductBySlug } from "@/features/products/catalog";

export const instant = false;

const benefits = [
  {
    icon: "✳",
    title: "Des consignes ciblées",
    description: "Chaque skill est construit autour d’un usage concret et d’une méthode claire.",
  },
  {
    icon: "▤",
    title: "Des guides pour démarrer",
    description: "Retrouvez les fichiers et les étapes pour utiliser le skill avec les outils indiqués.",
  },
  {
    icon: "↗",
    title: "Apprendre et avancer ensemble",
    description: "Les espaces communautaires et les académies prolongent l’apprentissage par l’échange et la pratique.",
  },
];

const steps = [
  { number: "01", title: "Choisissez votre besoin", description: "Parcourez le catalogue et vérifiez les usages ainsi que les outils compatibles." },
  { number: "02", title: "Installez le skill", description: "Suivez le guide fourni pour ajouter ses instructions à votre assistant." },
  { number: "03", title: "Adaptez-le à votre contexte", description: "Précisez votre objectif et votre façon de travailler pour obtenir une aide plus pertinente." },
];

export default async function HomePage() {
  const featuredProduct = await getCatalogProductBySlug("pack-marketing-reseau")
    ?? bundledProducts.find((product) => product.catalogStatus === "disponible")
    ?? bundledProducts[0];
  const salesEnabled = canCheckout(process.env.SKILLFLOW_COMMERCE_ENABLED);

  return (
    <main className="landing-home">
      <section className="landing-hero">
        <div className="landing-hero-inner">
          <div className="landing-copy">
            <span className="landing-kicker"><span aria-hidden="true">✦</span> Des skills IA pour le travail réel</span>
            <h1>Guidez votre IA<br />dans vos <span>tâches métier.</span></h1>
            <p className="landing-lede">Choisissez un skill pour un besoin concret, puis suivez son guide pour l’utiliser avec Claude ou ChatGPT. La communauté et les académies vous permettent de poursuivre l’apprentissage.</p>
            <div className="landing-actions">
              <Link href="/shop" className="landing-button landing-button-primary">Explorer le catalogue <span aria-hidden="true">→</span></Link>
              <Link href="#exemple-skill" className="landing-button landing-button-secondary"><span aria-hidden="true">▷</span> Voir un exemple</Link>
            </div>
            <p className="landing-proof"><span aria-hidden="true">✓</span> Un usage clairement défini <i /> <span aria-hidden="true">✓</span> Un guide pour démarrer</p>
          </div>
          <div id="exemple-skill" className="landing-demo-wrap">
            <AnimatedShowcase />
            <div className="landing-demo-note"><span aria-hidden="true">✦</span><div><strong>Un exemple de skill</strong><small>Le contenu varie selon le skill choisi</small></div></div>
          </div>
        </div>
      </section>

      <ScrollReveal>
        <section className="landing-value-section">
          <div className="landing-section-heading">
            <div><p className="landing-eyebrow">Pourquoi Skillsflow ?</p><h2>Vos méthodes. Votre IA.<br className="sm:hidden" /> <span>Un cadre pour avancer.</span></h2></div>
            <p>Des ressources pratiques pour mieux utiliser vos assistants IA dans votre travail quotidien.</p>
          </div>
          <div className="landing-benefits">
            {benefits.map((benefit) => <article key={benefit.title} className="landing-benefit-card"><span className="landing-benefit-icon" aria-hidden="true">{benefit.icon}</span><div><h3>{benefit.title}</h3><p>{benefit.description}</p></div><span className="landing-card-arrow" aria-hidden="true">↗</span></article>)}
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal>
        <section id="comment-ca-marche" className="landing-how-section">
          <div className="landing-section-heading landing-how-heading"><div><p className="landing-eyebrow">Simple à prendre en main</p><h2>Du besoin à la mise en pratique.</h2></div><p>Chaque fiche vous aide à comprendre l’usage du skill et la façon de commencer.</p></div>
          <div className="landing-steps">{steps.map((step) => <article key={step.number} className="landing-step"><span>{step.number}</span><h3>{step.title}</h3><p>{step.description}</p></article>)}</div>
        </section>
      </ScrollReveal>

      <ScrollReveal>
        <section className="landing-catalog-section">
          <div className="landing-catalog-copy"><p className="landing-eyebrow">Le catalogue Skillsflow</p><h2>Une méthode adaptée à votre prochain défi.</h2><p>Comparez les skills disponibles, leurs usages et leurs formats, puis choisissez celui qui correspond à votre besoin.</p><Link href="/shop" className="landing-text-link">Parcourir le catalogue <span aria-hidden="true">→</span></Link></div>
          {featuredProduct ? <article className="landing-featured-product"><div className="landing-product-meta"><span className="landing-status"><i />{salesEnabled ? "Disponible" : "À découvrir dans le catalogue"}</span><span>{featuredProduct.domain} · v{featuredProduct.version}</span></div><div className="landing-product-title"><span aria-hidden="true">✳</span><div><h3>{featuredProduct.name}</h3><p>{featuredProduct.tagline}</p></div></div><div className="landing-product-footer"><p><small>Prix du skill</small><strong>€{featuredProduct.price.toFixed(2)} <span>· {new Intl.NumberFormat("fr-FR").format(featuredProduct.priceXof)} XOF</span></strong></p><Link href={`/products/${featuredProduct.slug}`} className="landing-button landing-button-primary">Voir le skill <span aria-hidden="true">→</span></Link></div></article> : <p className="landing-empty">Le catalogue se prépare. Revenez bientôt découvrir les premiers skills.</p>}
        </section>
      </ScrollReveal>

      <PricingGrid />
      {/*
        <div className="mx-auto max-w-3xl text-center">
          <p className="landing-eyebrow">Des offres pour chaque étape</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">Commencez gratuitement, évoluez à votre rythme.</h2>
          <p className="mt-4 text-base leading-7 text-slate-300">Choisissez un skill à l’unité ou préparez votre passage vers un espace de travail IA plus personnalisé.</p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {pricingOffers.map((offer) => (
            <article key={offer.id} className={`relative flex h-full flex-col rounded-3xl border p-6 ${offer.highlight ? "border-cyan-300/55 bg-gradient-to-br from-cyan-300/[.14] to-blue-500/[.08] shadow-[0_18px_60px_rgba(32,221,242,.12)]" : "border-white/10 bg-white/[.035]"}`}>
              {offer.highlight && <span className="absolute right-5 top-5 rounded-full bg-cyan-300 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-950">{offer.highlight}</span>}
              <p className="text-sm font-bold uppercase tracking-wider text-cyan-200">{offer.name}</p>
              <p className="mt-5 text-3xl font-black text-white">{offer.price}</p>
              <p className="mt-1 text-sm text-slate-400">{offer.priceXof}</p>
              <p className="mt-5 min-h-14 text-sm leading-6 text-slate-300">{offer.description}</p>
              <ul className="mt-5 space-y-2 border-t border-white/10 pt-5 text-sm text-slate-200">
                {offer.features.map((feature) => <li key={feature} className="flex gap-2"><span className="text-cyan-300">✓</span><span>{feature}</span></li>)}
              </ul>
              {offer.checkoutHref ? (
                <Link href={offer.checkoutHref} className="mt-7 inline-flex min-h-11 items-center justify-center rounded-full bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200">{offer.cta}</Link>
              ) : (
                <Link href="/login?mode=signup" className="mt-7 inline-flex min-h-11 items-center justify-center rounded-full border border-cyan-300/35 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/[.08]">{offer.cta}</Link>
              )}
            </article>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-5 text-slate-500">Les abonnements Claude et ChatGPT sont facturés séparément par leurs éditeurs. Skillsflow fournit les skills, les méthodes, les guides et l’accompagnement.</p>
      */}
    </main>
  );
}
