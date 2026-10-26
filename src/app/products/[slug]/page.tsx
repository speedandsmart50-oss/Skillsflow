import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getCatalogProductBySlug } from "@/features/products/catalog";

const catalogStatusLabels = {
  a_venir: "À venir",
  en_preparation: "En préparation",
  disponible: "Disponible",
} as const;

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={<main className="min-h-screen bg-white" aria-busy="true" />}>
      <ProductDetailContent params={params} />
    </Suspense>
  );
}

async function ProductDetailContent({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await connection();
  const product = await getCatalogProductBySlug(slug);

  if (!product) {
    notFound();
  }
  const canPurchase = product.catalogStatus === "disponible" && (Boolean(product.zipFile) || Boolean(product.isMemberSkill) || Boolean(product.includedSkills?.length));
  const getPackSkillDescription = (name: string) => {
    const normalizedName = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’‘]/g, "'");
    if (normalizedName.includes("go pro")) return "Structure les étapes clés de votre activité, de la prospection au suivi de l’équipe.";
    if (normalizedName.includes("qualificateur")) return "Aide à poser les bonnes questions pour comprendre les besoins et l’intérêt d’un prospect, sans pression.";
    if (normalizedName.includes("coach d'equipe")) return "Aide à définir des objectifs, préparer des plans d’action et accompagner votre équipe.";
    if (normalizedName.includes("duplication")) return "Aide à expliquer les méthodes et les prochaines étapes aux nouveaux partenaires.";
    return "Un skill spécialisé inclus dans ce pack.";
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <BackLink href="/shop" className="mb-6">Retour au catalogue</BackLink>
      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-4 flex items-center justify-between gap-4">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
              {catalogStatusLabels[product.catalogStatus]}
            </span>
            <span className="text-sm font-medium text-slate-500">v{product.version}</span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">{product.name}</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">{product.domain}</p>
          <p className="mt-4 text-lg text-slate-600">{product.tagline}</p>
          <p className="mt-6 text-base leading-7 text-slate-600">{product.description}</p>

          {Boolean(product.includedSkills?.length) && (
            <div className="mt-8 rounded-2xl border border-violet-200 bg-violet-50 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-violet-900">Le pack comprend {product.includedSkills?.length} skills</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {product.includedSkills?.map((skill) => (
                  <li key={skill} className="rounded-xl border border-violet-200 bg-white/80 p-4">
                    <h3 className="font-semibold text-slate-900">{skill}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{getPackSkillDescription(skill)}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!product.includedSkills?.length && <div className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Le besoin</h2>
              <p className="mt-3 text-slate-600">{product.problem}</p>
          </div>}

          <div className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">{product.includedSkills?.length || product.isMemberSkill ? "Apr\u00e8s votre achat" : "Installation"}</h2>
            {product.includedSkills?.length ? (
              <p className="mt-3 text-slate-600">Apr&#232;s confirmation du paiement, les skills de ce pack seront activ&#233;s dans votre espace membre.</p>
            ) : product.isMemberSkill ? (
              <p className="mt-3 text-slate-600">L’achat active l’accès privé à ce skill dans votre espace membre, où vous pourrez configurer votre agent personnalisé.</p>
            ) : (
              <ol className="mt-3 list-decimal space-y-2 pl-6 text-slate-600">
                {product.installSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            )}
          </div>
        </section>

        <aside className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
          <div className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Prix</div>
          <div className="mt-4 text-4xl font-semibold text-slate-900">€{product.price.toFixed(2)}</div>
          <div className="mt-1 text-sm font-medium text-slate-600">{new Intl.NumberFormat("fr-FR").format(product.priceXof)} XOF</div>
          {canPurchase ? (
            <>
              <p className="mt-4 text-sm leading-6 text-slate-600">{product.includedSkills?.length ? "Le paiement est s\u00e9curis\u00e9 par SasPay. Les skills inclus seront activ\u00e9s dans votre espace membre apr\u00e8s confirmation." : product.isMemberSkill ? "Le paiement est s\u00e9curis\u00e9 par SasPay. Votre acc\u00e8s au skill sera activ\u00e9 dans votre espace membre apr\u00e8s confirmation du paiement." : "Le paiement est s\u00e9curis\u00e9 par SasPay. Votre t\u00e9l\u00e9chargement sera disponible dans votre compte apr\u00e8s confirmation du paiement."}</p>
              <Link href={`/checkout?product=${encodeURIComponent(product.slug)}`} className="mt-6 block w-full rounded-full bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white">
                Payer
              </Link>
            </>
          ) : (
            <p className="mt-4 text-sm leading-6 text-slate-600">Ce skill n’est pas encore disponible à l’achat. Revenez bientôt pour découvrir sa sortie.</p>
          )}
          <div className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Historique des versions</h3>
            <ul className="mt-3 space-y-3 text-sm text-slate-600">
              {product.versions.map((release) => (
                <li key={release.version} className="border-b border-slate-200 pb-2 last:border-0">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-slate-900">{release.version}</strong>
                    <span>{release.date}</span>
                  </div>
                  {release.notes.map((note) => (
                    <div key={note} className="mt-1 text-xs text-slate-500">• {note}</div>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}
