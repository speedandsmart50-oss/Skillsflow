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
    description: "Pour découvrir SkillFlow et commencer à apprendre.",
    features: ["Compte personnel", "Catalogue et contenus gratuits", "Skill découverte", "Communauté en lecture", "Tutoriels de base"],
    checkoutHref: "/login?mode=signup",
    cta: "Créer mon compte",
    availability: "free",
  },
  {
    id: "premium-skill",
    name: "Skill Premium",
    price: "39 €",
    priceXof: "25 600 XOF",
    description: "Un skill professionnel complet, prêt à utiliser.",
    features: ["Skill spécialisé", "Guides Claude et ChatGPT", "Exemples métier", "Configuration MCP si disponible", "Mises à jour pendant 12 mois", "Support standard"],
    highlight: "Le plus choisi",
    checkoutHref: "/checkout?product=prospection-ethique",
    cta: "Acheter ce skill",
    availability: "available",
  },
  {
    id: "pack",
    name: "Pack de skills",
    price: "69 €",
    priceXof: "45 300 XOF",
    description: "Plusieurs skills professionnels réunis dans une seule offre.",
    features: ["3 skills professionnels", "Guide d'installation", "Modèles prêts à l'emploi", "Mises à jour pendant 12 mois", "Accès aux ateliers collectifs", "Économie sur l'achat séparé"],
    checkoutHref: "/checkout?product=pack-marketing-reseau",
    cta: "Acheter le pack",
    availability: "available",
  },
  {
    id: "plus",
    name: "SkillFlow Plus",
    price: "14,90 €/mois",
    priceXof: "9 800 XOF/mois",
    description: "Pour utiliser régulièrement les ressources SkillFlow.",
    features: ["Skills standards", "Nouvelles ressources chaque mois", "Communauté complète", "Messages privés", "Ateliers collectifs", "20 % sur les skills Premium"],
    cta: "Bientôt disponible",
    availability: "planned",
  },
  {
    id: "pro",
    name: "SkillFlow Pro",
    price: "29,90 €/mois",
    priceXof: "19 600 XOF/mois",
    description: "Pour les professionnels qui veulent aller plus loin.",
    features: ["Tous les skills", "Tutoriels Claude et MCP avancés", "Configurations personnalisées", "Support prioritaire", "Sessions mensuelles", "30 % sur l'accompagnement"],
    highlight: "Accès AIOS",
    cta: "Demander un accès Pro",
    availability: "planned",
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
