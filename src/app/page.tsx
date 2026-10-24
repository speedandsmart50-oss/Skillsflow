import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { products } from "@/features/products/products";

const benefits = [
  "Secure product delivery and signed ZIP access",
  "Version-aware customer permissions",
  "Simple admin workflows for product publishing",
];

const skillCards = [
  {
    title: "Skill Copywriting & Conversion",
    description: "Rédige des pages de vente, mails et hooks qui convertissent sans frictions.",
    tag: "01 · prêt à injecter",
  },
  {
    title: "Skill Analyste Stratégique",
    description: "Décortique données, chiffres et stratégie pour orienter les décisions.",
    tag: "02 · prêt à injecter",
  },
  {
    title: "Skill Développeur Full-Stack",
    description: "Produit du code propre, structure les projets et corrige les blocages rapides.",
    tag: "03 · prêt à injecter",
  },
  {
    title: "Skill Automatisation & Productivité",
    description: "Met en place des flux, automatisations et routines qui gagnent du temps.",
    tag: "04 · prêt à injecter",
  },
];

const steps = [
  { number: "1", title: "Inscrivez-vous", text: "Remplissez le formulaire pour recevoir votre accès direct." },
  { number: "2", title: "Téléchargez le dossier", text: "Récupérez le pack prêt à l’emploi en un clic." },
  { number: "3", title: "Glissez-le dans Claude ou ChatGPT", text: "Votre IA est immédiatement augmentée et opérationnelle." },
];

export default function HomePage() {
  return (
    <main className="relative overflow-hidden bg-[#0d1321] text-white">
      <div className="pointer-events-none absolute inset-x-0 top-[-180px] mx-auto h-[500px] w-[1000px] rounded-full bg-gradient-to-b from-cyan-400/10 via-sky-400/5 to-transparent blur-[120px]" />

      <section className="mx-auto max-w-[1200px] px-4 pb-20 pt-12 sm:px-6 lg:px-8 lg:pb-28 lg:pt-16">
        <div className="grid items-center gap-12 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200">
              <span className="h-2 w-2 rounded-full bg-cyan-300 animate-ping" />
              Mise à jour v2.4 disponible
            </div>

            <h1 className="mt-6 max-w-xl text-4xl font-black leading-tight tracking-[-0.04em] text-white sm:text-5xl lg:text-[64px] lg:leading-[72px]">
              Donnez à votre IA des super-pouvoirs. <span className="bg-gradient-to-r from-cyan-300 to-sky-400 bg-clip-text text-transparent">En 2 minutes.</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg text-slate-300">
              Un pack de skills prêts à l’emploi pour Claude et ChatGPT. Téléchargez, glissez dans votre IA, et elle travaille comme un expert.
            </p>

            <div className="mt-8 rounded-2xl border border-cyan-400/20 bg-slate-900/60 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
              <form className="space-y-4">
                <div>
                  <label htmlFor="prenom" className="mb-1.5 block text-sm font-medium text-white">Prénom</label>
                  <input id="prenom" name="prenom" placeholder="Ex. Alex" className="h-[52px] w-full rounded-lg border border-cyan-400/20 bg-slate-950/80 px-4 text-white placeholder:text-slate-500 focus:border-cyan-300 focus:outline-none" required />
                </div>
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-white">Adresse email</label>
                  <input id="email" name="email" type="email" placeholder="alex@entreprise.com" className="h-[52px] w-full rounded-lg border border-cyan-400/20 bg-slate-950/80 px-4 text-white placeholder:text-slate-500 focus:border-cyan-300 focus:outline-none" required />
                </div>

                <div className="flex items-start gap-3 pt-1">
                  <input id="consent" type="checkbox" defaultChecked className="mt-1 h-4 w-4 rounded border-cyan-300/40 bg-slate-950 text-cyan-300" required />
                  <label htmlFor="consent" className="text-sm text-slate-300">
                    Je veux recevoir le pack et les prochains skills par email.
                  </label>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3.5 py-2 text-sm text-cyan-100">
                  <span>Coupon A activé</span>
                  <span className="rounded-full bg-cyan-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-900">OFFRE SPÉCIALE</span>
                </div>

                <button type="submit" className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-300 to-sky-400 text-sm font-bold uppercase tracking-[0.08em] text-slate-900 shadow-[0_8px_32px_rgba(34,211,238,0.4)] transition hover:brightness-110">
                  Valider & Accéder au Pack
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="mx-auto max-w-[500px] rounded-[24px] border border-cyan-400/20 bg-slate-900/80 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
              <div className="flex items-center justify-between border-b border-slate-700 pb-4">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-400/70" />
                  <span className="h-3 w-3 rounded-full bg-amber-300/70" />
                  <span className="h-3 w-3 rounded-full bg-emerald-400/70" />
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <span className="text-cyan-300">◉</span>
                  Claude 3.5 Sonnet & ChatGPT
                </div>
              </div>

              <div className="space-y-4 py-6 text-sm">
                <div className="rounded-lg border border-slate-700 bg-slate-800/80 p-3.5 text-slate-200">
                  <div className="mb-1 flex items-center gap-2 font-semibold text-white">
                    <span className="text-cyan-300">✦</span>
                    Prompt standard initial
                  </div>
                  « Rédige un plan stratégique d’acquisition client B2B. »
                </div>

                <div className="flex items-center justify-between rounded-xl border border-cyan-400/30 bg-gradient-to-r from-cyan-400/10 to-sky-500/10 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-300">ZIP</div>
                    <div>
                      <div className="font-semibold text-white">skills-pack.zip</div>
                      <div className="text-xs text-cyan-200">Injecté avec succès dans le contexte</div>
                    </div>
                  </div>
                  <span className="text-cyan-300">✓</span>
                </div>

                <div className="rounded-lg border border-cyan-400/20 bg-slate-800/80 p-3.5 text-slate-200">
                  <div className="mb-1 flex items-center gap-2 font-semibold text-cyan-300">
                    <span>✓</span>
                    Réponse avec Skill Stratégie Senior activé
                  </div>
                  <div className="text-slate-300">
                    ✓ Matrice ICP hiérarchisée définie<br />
                    ✓ Décomposition CAC/LTV & cycles de conversion<br />
                    ✓ Plan d’action séquencé en 4 sprints mesurables
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-400">
                Poser une question avec les skills chargés... <span className="float-right text-cyan-300">→</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Système clé en main</p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-white sm:text-5xl">Ce que contient le pack</h2>
          <p className="mt-4 text-lg text-slate-300">Des compétences calibrées pour décupler vos livrables et accélérer votre productivité.</p>
          <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-3 rounded-full border border-cyan-400/15 bg-slate-900/60 px-4 py-2 text-sm text-slate-200">
            <span>Compatible :</span>
            <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-white">Claude</span>
            <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-white">ChatGPT</span>
          </div>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {skillCards.map((card) => (
            <div key={card.title} className="rounded-xl border border-cyan-400/15 bg-slate-900/50 p-6 shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-sm transition hover:-translate-y-1 hover:border-cyan-400/30">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/10 text-xl text-cyan-300">✦</div>
              <h3 className="text-xl font-semibold text-white">{card.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">{card.description}</p>
              <div className="mt-6 border-t border-slate-700 pt-4 text-xs font-medium uppercase tracking-[0.12em] text-cyan-300">{card.tag}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Flux d’activation</p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-white sm:text-5xl">Comment ça marche</h2>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {steps.map((step) => (
            <div key={step.number} className="rounded-xl border border-cyan-400/15 bg-slate-900/50 p-8 backdrop-blur-sm">
              <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-full border border-cyan-400/30 bg-slate-950 text-lg font-bold text-cyan-300">{step.number}</div>
              <h3 className="mb-3 text-2xl font-semibold text-white">{step.title}</h3>
              <p className="text-slate-300">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-4 pb-20 pt-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="rounded-2xl border border-cyan-400/15 bg-slate-900/60 p-6">
            <div className="text-3xl font-black text-cyan-300">+175%</div>
            <div className="mt-3 text-slate-300">Gain de vitesse sur les tâches répétitives.</div>
          </div>
          <div className="rounded-2xl border border-cyan-400/15 bg-slate-900/60 p-6">
            <div className="text-3xl font-black text-cyan-300">2 min</div>
            <div className="mt-3 text-slate-300">Pour installer et lancer le pack dans votre workflow.</div>
          </div>
          <div className="rounded-2xl border border-cyan-400/15 bg-slate-900/60 p-6">
            <div className="text-3xl font-black text-cyan-300">24/7</div>
            <div className="mt-3 text-slate-300">24/7 Une IA plus constante, plus rapide, plus structurée.</div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-4 pb-20 sm:px-6 lg:px-8">
        <div className="rounded-[28px] border border-cyan-400/15 bg-gradient-to-r from-slate-900 to-slate-800 p-8 text-center shadow-[0_10px_50px_rgba(0,0,0,0.35)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Votre prochain avantage</p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-white sm:text-5xl">Donnez à votre IA les bons réflexes.</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/shop" className="rounded-full bg-cyan-300 px-6 py-3 text-sm font-bold uppercase tracking-[0.08em] text-slate-900 transition hover:bg-cyan-200">Explorer le pack</Link>
            <Link href="/account" className="rounded-full border border-cyan-400/20 px-6 py-3 text-sm font-bold uppercase tracking-[0.08em] text-white transition hover:border-cyan-300">Voir l’espace membre</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
