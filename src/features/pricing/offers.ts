export type PricingFrequency = "monthly" | "annual";
export type PricingAvailability = "free" | "available" | "planned";

export type PricingFeature = {
  text: string;
  children?: string[];
};

export type PricingOffer = {
  id: "discovery" | "plus" | "pro" | "max";
  name: string;
  badge?: string;
  monthly: { eur: string; xof: string };
  annual?: { eur: string; xof: string; note: string };
  description: string;
  prefix?: string;
  features: PricingFeature[];
  cta: string;
  checkoutHref?: string;
  availability: PricingAvailability;
};

export const pricingOffers: PricingOffer[] = [
  {
    id: "discovery",
    name: "Découverte",
    monthly: { eur: "0 €", xof: "0 XOF" },
    annual: { eur: "0 €", xof: "0 XOF", note: "Toujours gratuit" },
    description: "Pour découvrir Skillsflow et commencer à apprendre.",
    features: [
      { text: "Compte personnel" },
      { text: "Catalogue et contenus gratuits" },
      { text: "Skill découverte" },
      { text: "Communauté générale en lecture" },
      { text: "Tutoriels de base" },
    ],
    cta: "Créer mon compte",
    checkoutHref: "/login?mode=signup",
    availability: "free",
  },
  {
    id: "plus",
    name: "Skillsflow Plus",
    monthly: { eur: "14,90 €", xof: "9 800 XOF" },
    annual: { eur: "149 €", xof: "97 700 XOF", note: "2 mois offerts" },
    description: "Pour travailler régulièrement avec un skill et être accompagné par la communauté.",
    features: [
      { text: "Toutes les ressources et tous les tutoriels" },
      { text: "1 skill au choix, avec ses mises à jour chaque mois" },
      { text: "Communauté générale complète : coaching, entraide, motivation" },
      { text: "Messages privés" },
      { text: "Ateliers collectifs" },
      { text: "Support : réponse sous 72 h ouvrées" },
    ],
    cta: "Choisir Plus",
    checkoutHref: "/checkout?product=skillflow-plus",
    availability: "available",
  },
  {
    id: "pro",
    name: "Skillsflow Pro",
    badge: "Recommandé",
    monthly: { eur: "29,90 €", xof: "19 600 XOF" },
    annual: { eur: "299 €", xof: "196 100 XOF", note: "2 mois offerts" },
    description: "Pour les leaders qui construisent leur équipe.",
    prefix: "Tout Plus, et en plus :",
    features: [
      { text: "Espace privé Leaders : travaillez avec vos partenaires, fixez des objectifs communs, suivez la progression" },
      { text: "2 skills au choix, avec leurs mises à jour mensuelles" },
      { text: "5 sessions par mois : 4 sessions collectives en visio de 45 min (1 par semaine) et 1 session individuelle de 30 min" },
      { text: "Sessions enregistrées, à revoir quand vous voulez" },
      { text: "Tutoriels Claude et MCP avancés" },
      { text: "Configurations personnalisées" },
      { text: "Support prioritaire : réponse sous 24 h ouvrées" },
    ],
    cta: "Choisir Pro",
    checkoutHref: "/checkout?product=skillflow-pro",
    availability: "available",
  },
  {
    id: "max",
    name: "Skillsflow Max",
    badge: "Accès Jarvis",
    monthly: { eur: "69 €", xof: "45 300 XOF" },
    annual: { eur: "690 €", xof: "452 600 XOF", note: "2 mois offerts" },
    description: "Pour ceux qui veulent un assistant IA personnel, connecté à leur quotidien.",
    prefix: "Tout Pro, et en plus :",
    features: [
      {
        text: "Programme Jarvis, votre assistant dynamique synchronisé sur téléphone et ordinateur",
        children: [
          "Étape 1, collecte de données (mois 1 à 2) : connexion progressive à vos sources (Google, WhatsApp et les autres canaux où vous échangez le plus), avec votre accord avant toute collecte",
          "Étape 2, implémentation (à partir du mois 3) : mise en service de l'assistant, puis automatisations de plus en plus poussées",
        ],
      },
      { text: "3 skills au choix, avec leurs mises à jour mensuelles" },
      { text: "7 sessions par mois, dont 2 sessions individuelles de 30 min dédiées à Jarvis" },
      { text: "Accompagnement dédié : session de lancement de 60 min, suivi mensuel, messagerie directe avec l'équipe" },
      { text: "Support prioritaire renforcé : réponse sous 12 h ouvrées" },
    ],
    cta: "Choisir Max",
    availability: "planned",
  },
];

export const pricingPageContent = {
  title: "Choisissez le pack qui correspond à votre façon de travailler",
  subtitle: "Du premier pas à l'assistant IA personnel : avancez à votre rythme, changez de pack quand vous voulez.",
  privacyTitle: "Vos données, vos règles",
  privacyItems: [
    "Vos données servent uniquement à votre assistant.",
    "Vous pouvez les exporter ou les supprimer à tout moment.",
    "Aucune source n'est connectée sans votre accord.",
  ],
  faq: [
    { question: "Qu'est-ce qu'un skill ?", answer: "Une ressource prête à l'emploi qui vous aide à accomplir une tâche précise avec l'IA, par exemple rédiger vos messages de prospection." },
    // TODO: confirmer la règle de changement de skill avant publication définitive.
    { question: "Puis-je changer de skill ?", answer: "Les modalités de changement de skill seront précisées prochainement." },
    { question: "Puis-je changer de pack ou arrêter ?", answer: "Oui, vous pouvez passer à un pack supérieur ou inférieur, ou arrêter votre abonnement quand vous le souhaitez." },
    // TODO: confirmer les moyens de paiement disponibles en Afrique de l'Ouest.
    { question: "Comment payer depuis l'Afrique de l'Ouest ?", answer: "Les moyens de paiement disponibles seront précisés au moment du choix de votre pack." },
    { question: "Jarvis est-il disponible dès aujourd'hui ?", answer: "Jarvis se construit par étapes. Vous commencez par la collecte de vos données, puis nous mettons en service votre assistant. Votre accompagnateur vous indique où vous en êtes à chaque session." },
  ],
};

export function getOfferById(id: string) {
  return pricingOffers.find((offer) => offer.id === id);
}

