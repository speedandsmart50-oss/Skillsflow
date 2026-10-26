import Link from "next/link";
import { AnimatedShowcase } from "@/components/landing/animated-showcase";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { products as bundledProducts } from "@/features/products/products";
import { canCheckout } from "@/lib/commerce";

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

export default function HomePage() {
  const featuredProduct = bundledProducts.find((product) => product.catalogStatus === "disponible") ?? bundledProducts[0];
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
            <div><p className="landing-eyebrow">Pourquoi SkillFlow ?</p><h2>Vos méthodes. Votre IA.<br className="sm:hidden" /> <span>Un cadre pour avancer.</span></h2></div>
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
          <div className="landing-catalog-copy"><p className="landing-eyebrow">Le catalogue SkillFlow</p><h2>Une méthode adaptée à votre prochain défi.</h2><p>Comparez les skills disponibles, leurs usages et leurs formats, puis choisissez celui qui correspond à votre besoin.</p><Link href="/shop" className="landing-text-link">Parcourir le catalogue <span aria-hidden="true">→</span></Link></div>
          {featuredProduct ? <article className="landing-featured-product"><div className="landing-product-meta"><span className="landing-status"><i />{salesEnabled ? "Disponible" : "À découvrir dans le catalogue"}</span><span>{featuredProduct.domain} · v{featuredProduct.version}</span></div><div className="landing-product-title"><span aria-hidden="true">✳</span><div><h3>{featuredProduct.name}</h3><p>{featuredProduct.tagline}</p></div></div><div className="landing-product-footer"><p><small>Prix du skill</small><strong>€{featuredProduct.price.toFixed(2)} <span>· {new Intl.NumberFormat("fr-FR").format(featuredProduct.priceXof)} XOF</span></strong></p><Link href={`/products/${featuredProduct.slug}`} className="landing-button landing-button-primary">Voir le skill <span aria-hidden="true">→</span></Link></div></article> : <p className="landing-empty">Le catalogue se prépare. Revenez bientôt découvrir les premiers skills.</p>}
        </section>
      </ScrollReveal>
    </main>
  );
}
