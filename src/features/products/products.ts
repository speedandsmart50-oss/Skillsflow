import type { Product } from "@/types/skillflow";
import { calculateProductPrice } from "@/lib/pricing";

const currentPrice = calculateProductPrice();
export const products: Product[] = [
  {
    id: "skill-prospection-ethique",
    slug: "prospection-ethique",
    name: "Prospection éthique avec l’IA",
    tagline: "Préparez des prises de contact utiles, honnêtes et sans pression.",
    description:
      "Une compétence originale pour qualifier une audience, rédiger une invitation commerciale claire et préparer une relance respectueuse, sur Claude ou ChatGPT.",
    problem:
      "La prospection impersonnelle ou insistante abîme la confiance. Ce pack aide à proposer une offre avec transparence et à respecter un refus.",
    stack: ["Claude", "ChatGPT", "Ordinateur", "Téléphone"],
    installSteps: [
      "Sur Claude, importez la Skill depuis les paramètres si votre compte propose cette fonction.",
      "Sur ChatGPT, copiez les instructions du pack dans un projet ou une conversation.",
      "Sur téléphone, ouvrez le même compte ou copiez les instructions dans une conversation.",
    ],
    price: currentPrice.totalEur,
    priceXof: currentPrice.totalXof,
    version: "1.0.0",
    status: "published",
    zipFile: "prospection-ethique-v1.0.0.zip",
    compatibleAgents: ["Claude", "ChatGPT"],
    versions: [
      { version: "1.0.0", date: "2026-10-24", notes: ["Pack multiplateforme avec skill Claude, instructions ChatGPT et guide d’installation"], status: "published" },
    ],
  },
];

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((product) => product.slug === slug);
}
