import Link from "next/link";
import { connection } from "next/server";

export const metadata = {
  title: "Closing & Négociation | Communauté SkillFlow",
  description: "Un parcours progressif pour mieux écouter, conseiller et accompagner une décision éclairée.",
};
export const instant = false;

const levels = [
  {
    number: "01",
    title: "Fondamentaux",
    summary: "Écoute active, questions ouvertes, compréhension des besoins et conclusion respectueuse.",
    topics: [
      "Comprendre la vente et le rôle du closer",
      "Distinguer vendre, conseiller et convaincre",
      "Comprendre les besoins, motivations et contraintes",
      "Pratiquer l’écoute active",
      "Poser des questions ouvertes",
      "Reformuler pour vérifier la compréhension",
      "Présenter une offre sans réciter un argumentaire",
      "Comprendre le prix, la valeur et les limites d’une offre",
      "Reconnaître une absence d’intérêt",
      "Conclure proprement une conversation",
    ],
  },
  {
    number: "02",
    title: "Intermédiaire",
    summary: "Qualification, conversations adaptées au canal et prochaines étapes pertinentes.",
    topics: [
      "Qualifier un prospect",
      "Personnaliser une approche sur les réseaux sociaux",
      "Mener une conversation en messages privés",
      "Présenter une opportunité en appel ou visioconférence",
      "Traiter les objections fréquentes",
      "Clarifier les hésitations",
      "Effectuer des relances pertinentes",
      "Expliquer conditions, coûts et limites",
      "Proposer une prochaine étape adaptée",
      "Reconnaître quand ne pas conclure",
    ],
  },
  {
    number: "03",
    title: "Avancé",
    summary: "Conversations complexes, négociation responsable et développement de son style.",
    topics: [
      "Gérer les objections complexes",
      "Conduire des conversations avec plusieurs interlocuteurs",
      "Adapter sa communication au contexte et au canal",
      "Répondre aux comparaisons avec d’autres solutions",
      "Négocier dans le respect des limites commerciales",
      "Analyser les signaux d’intérêt sans prétendre lire les pensées",
      "Structurer une conversation sans script rigide",
      "Analyser les raisons d’un refus",
      "Développer son style commercial",
      "Accompagner les nouveaux partenaires dans leur apprentissage",
    ],
  },
  {
    number: "04",
    title: "Expert & mentor",
    summary: "Analyse, feedback et amélioration continue des pratiques de l’équipe.",
    topics: [
      "Analyser des conversations complexes",
      "Identifier les erreurs récurrentes",
      "Construire des scénarios d’entraînement",
      "Former et évaluer d’autres partenaires",
      "Concevoir des grilles de feedback",
      "Adapter les méthodes aux produits et aux marchés",
      "Développer un système d’amélioration continue",
      "Mesurer sans confondre corrélation et causalité",
    ],
  },
];

const nextFeatures = [
  { id: "simulations", title: "Simuler une conversation", description: "S’entraîner à partir de situations et de niveaux de difficulté différents." },
  { id: "objections", title: "Travailler les objections", description: "Comprendre une hésitation sans chercher à contourner un refus." },
  { id: "analyse", title: "Analyser une conversation", description: "Étudier un échange anonymisé et en tirer des pistes d’apprentissage." },
  { id: "progression", title: "Suivre ma progression", description: "Retrouver les exercices réalisés et les compétences travaillées." },
];

export default async function ClosingNegociationPage() {
  await connection();
  return (
    <main className="mx-auto max-w-6xl">
      <Link href="/community" className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-300/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
        <span aria-hidden="true">←</span> Retour aux salons
      </Link>

      <section className="animate-rise relative mt-4 overflow-hidden rounded-3xl border border-cyan-300/25 bg-[radial-gradient(ellipse_at_82%_15%,rgba(34,211,238,.18),transparent_38%),linear-gradient(130deg,#10283a,#101a2b_58%,#15162f)] p-6 shadow-[0_20px_65px_rgba(0,0,0,.22)] sm:p-9">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full border border-cyan-200/10 bg-cyan-300/[.04] blur-2xl" />
        <div className="relative max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[.22em] text-cyan-300">Parcours SkillFlow</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">Closing &amp; Négociation</h1>
          <p className="mt-4 text-base leading-7 text-slate-200 sm:text-lg">Apprenez à mieux comprendre, conseiller et accompagner vos prospects jusqu’à une décision éclairée.</p>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Un parcours de pratique commerciale responsable. Il ne promet ni revenus ni taux de conversion et rappelle qu’un refus doit être respecté.</p>
          <a href="#parcours" className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100 motion-reduce:transform-none">Découvrir le parcours <span aria-hidden="true">↓</span></a>
        </div>
      </section>

      <section id="parcours" className="scroll-mt-6 py-10 sm:py-12" aria-labelledby="learning-path-title">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Votre progression</p><h2 id="learning-path-title" className="mt-2 text-2xl font-bold text-white sm:text-3xl">Un parcours en quatre niveaux</h2></div>
          <span className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-slate-300">Plan pédagogique</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {levels.map((level) => (
            <article key={level.number} id={`niveau-${level.number}`} className="animate-rise scroll-mt-6 rounded-2xl border border-slate-700/80 bg-[#101a2b] p-5 transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/35 hover:shadow-[0_16px_38px_rgba(0,0,0,.2)] sm:p-6 motion-reduce:transform-none">
              <div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/[.08] text-sm font-black text-cyan-200">{level.number}</span><div><h3 className="text-xl font-bold text-white">{level.title}</h3><p className="mt-1 text-sm leading-6 text-slate-300">{level.summary}</p></div></div>
              <details className="group mt-5 border-t border-slate-700/70 pt-4">
                <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"><span>Voir les thèmes ({level.topics.length})</span><span aria-hidden="true" className="transition-transform group-open:rotate-180">⌄</span></summary>
                <ol className="mt-3 grid gap-2 sm:grid-cols-2">{level.topics.map((topic, index) => <li key={topic} className="flex items-start gap-2 rounded-xl bg-slate-950/35 px-3 py-2.5 text-sm leading-5 text-slate-200"><span className="mt-0.5 text-xs font-bold tabular-nums text-cyan-300">{String(index + 1).padStart(2, "0")}</span><span>{topic}</span></li>)}</ol>
              </details>
            </article>
          ))}
        </div>
      </section>

      <section className="pb-10 sm:pb-12" aria-labelledby="practice-title">
        <div className="mb-5"><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Apprendre en pratiquant</p><h2 id="practice-title" className="mt-2 text-2xl font-bold text-white sm:text-3xl">Les espaces de pratique prévus</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Le programme et les thèmes sont présentés ici. Les outils interactifs seront ouverts après leur intégration et leurs vérifications.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {nextFeatures.map((feature) => <article key={feature.id} id={feature.id} className="scroll-mt-6 rounded-2xl border border-slate-700/80 bg-slate-900/55 p-4"><span className="inline-flex rounded-full border border-amber-200/20 bg-amber-200/[.06] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-100">À venir</span><h3 className="mt-3 font-bold text-white">{feature.title}</h3><p className="mt-1 text-sm leading-6 text-slate-300">{feature.description}</p></article>)}
        </div>
      </section>

      <aside className="mb-8 rounded-2xl border border-emerald-300/20 bg-emerald-300/[.05] p-5 sm:p-6" aria-label="Engagement éthique">
        <p className="text-sm font-bold text-emerald-100">Une pratique commerciale respectueuse</p>
        <p className="mt-2 text-sm leading-6 text-slate-300">Pas de promesse de revenus, de fausse urgence ou de pression. Une bonne décision peut aussi être de demander du temps ou de mettre fin à l’échange.</p>
      </aside>
    </main>
  );
}
