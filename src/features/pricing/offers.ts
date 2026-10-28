export type PricingOffer = {
  id: string;
  name: string;
  price: string;
  priceXof: string;
  description: string;
  features: string[];
  highlight?: string;
  checkoutHref?: string;
  cta: string;
  availability: "free" | "available" | "planned";
};

export const pricingOffers: PricingOffer[] = [
  {
    id: "free",
    name: "Gratuit",
    price: "0 €",
    priceXof: "0 XOF",
    description: "Pour découvrir Skillsflow et commencer à apprendre.",
    features: ["Compte personnel", "Catalogue et contenus gratuits", "Skill découverte", "Communauté en lecture", "Tutoriels de base"],
    checkoutHref: "/login?mode=signup",
    cta: "Créer mon compte",
    availability: "free",
  },
  {
    id: "premium-skill",
    name: "Prospection éthique avec l’IA",
    price: "39 €",
    priceXof: "25 600 XOF",
    description: "Préparez des prises de contact utiles, honnêtes et sans pression.",
    features: ["Skill spécialisé", "Guides Claude et ChatGPT", "Exemples métier", "Configuration MCP si disponible", "Mises à jour pendant 12 mois", "Support standard"],
    highlight: "Le plus choisi",
    checkoutHref: "/checkout?product=prospection-ethique",
    cta: "Acheter ce skill",
    availability: "available",
  },
  {
    id: "plus",
    name: "Skillsflow Plus",
    price: "14,90 €/mois",
    priceXof: "9 800 XOF/mois",
    description: "Pour utiliser régulièrement les ressources Skillsflow.",
    features: ["Skills standards", "Nouvelles ressources chaque mois", "Communauté complète", "Messages privés", "Ateliers collectifs", "20 % sur les skills Premium"],
    checkoutHref: "/checkout?product=skillflow-plus",
    cta: "S’abonner",
    availability: "available",
  },
  {
    id: "pro",
    name: "Skillsflow Pro",
    price: "29,90 €/mois",
    priceXof: "19 600 XOF/mois",
    description: "Pour les professionnels qui veulent aller plus loin.",
    features: ["Tous les skills", "Tutoriels Claude et MCP avancés", "Configurations personnalisées", "Support prioritaire", "Sessions mensuelles", "30 % sur l'accompagnement"],
    highlight: "Accès AIOS",
    checkoutHref: "/checkout?product=skillflow-pro",
    cta: "S’abonner à Pro",
    availability: "available",
  },
  {
    id: "aios",
    name: "AIOS — Jarvis personnalisé",
    price: "Sur devis",
    priceXof: "Sur devis",
    description: "Construisez un assistant IA adapté à vos méthodes, vos outils et votre contexte.",
    features: ["Assistant personnel personnalisé", "Base de connaissances privée", "Automatisation progressive", "Connexion aux outils métier", "Données contrôlées par le client", "Accompagnement dédié"],
    highlight: "Offre avancée",
    cta: "Parler du projet AIOS",
    availability: "planned",
  },
];

export function getOfferById(id: string) {
  return pricingOffers.find((offer) => offer.id === id);
}
