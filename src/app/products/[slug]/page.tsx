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
    <Suspense fallback={<main className="min-h-screen bg-[#0d1321]" aria-busy="true" />}>
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
  const canPurchase = product.catalogStatus === "disponible" && (Boolean(product.zipFile) || Boolean(product.isMemberSkill) || Boolean(product.includedSkills?.length) || Boolean(product.isSubscription));
  const getPackSkillDescription = (name: string) => {
    const normalizedName = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’‘]/g, "'");
    if (normalizedName.includes("go pro")) return "Structure les étapes clés de votre activité, de la prospection au suivi de l’équipe.";
    if (normalizedName.includes("qualificateur")) return "Aide à poser les bonnes questions pour comprendre les besoins et l’intérêt d’un prospect, sans pression.";
    if (normalizedName.includes("coach d'equipe")) return "Aide à définir des objectifs, préparer des plans d’action et accompagner votre équipe.";
    if (normalizedName.includes("duplication")) return "Aide à expliquer les méthodes et les prochaines étapes aux nouveaux partenaires.";
    return "Un skill spécialisé inclus dans ce pack.";
  };

  return (
    <main className="min-h-screen bg-[#0d1321] px-4 py-12 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
      <BackLink href="/shop" className="mb-6">Retour au catalogue</BackLink>
      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-3xl border border-[#202E50] bg-[#151F38] p-6 shadow-[0_18px_55px_rgba(0,0,0,.18)] sm:p-8">
          <div className="mb-4 flex items-center justify-between gap-4">
            <span className="rounded-full border border-[#20DDF2]/20 bg-[#20DDF2]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#70E9F5]">
              {catalogStatusLabels[product.catalogStatus]}
            </span>
            <span className="text-sm font-medium text-[#8F9CAE]">v{product.version}</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white">{product.name}</h1>
          <p className="mt-2 text-sm font-semibold text-[#70E9F5]">{product.domain}</p>
          <p className="mt-4 text-lg text-[#C5D3E2]">{product.tagline}</p>
          <p className="mt-6 text-base leading-7 text-[#A8B7CB]">{product.description}</p>

          {Boolean(product.includedSkills?.length) && (
            <div className="mt-8 rounded-2xl border border-[#2C4266] bg-[#0E1B2E] p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#70E9F5]">Le pack comprend {product.includedSkills?.length} skills</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {product.includedSkills?.map((skill) => (
                  <li key={skill} className="rounded-xl border border-[#24344F] bg-[#111A2B] p-4">
                    <h3 className="font-semibold text-white">{skill}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#A8B7CB]">{getPackSkillDescription(skill)}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!product.includedSkills?.length && <div className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#8F9CAE]">Le besoin</h2>
              <p className="mt-3 text-[#A8B7CB]">{product.problem}</p>
          </div>}

          <div className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#8F9CAE]">{product.includedSkills?.length || product.isMemberSkill ? "Apr\u00e8s votre achat" : "Installation"}</h2>
            {product.includedSkills?.length ? (
              <p className="mt-3 text-[#A8B7CB]">Apr&#232;s confirmation du paiement, les skills de ce pack seront activ&#233;s dans votre espace membre.</p>
            ) : product.isMemberSkill ? (
              <p className="mt-3 text-[#A8B7CB]">L’achat active l’accès privé à ce skill dans votre espace membre, où vous pourrez configurer votre agent personnalisé.</p>
            ) : (
              <ol className="mt-3 list-decimal space-y-2 pl-6 text-[#A8B7CB]">
                {product.installSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            )}
          </div>
        </section>

        <aside className="h-fit rounded-3xl border border-[#202E50] bg-[#11182B] p-6 shadow-[0_18px_55px_rgba(0,0,0,.18)]">
          <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8F9CAE]">Prix</div>
          <div className="mt-4 text-4xl font-semibold text-white">€{product.price.toFixed(2)}</div>
          <div className="mt-1 text-sm font-medium text-[#A8B7CB]">{new Intl.NumberFormat("fr-FR").format(product.priceXof)} XOF</div>
          {canPurchase ? (
            <>
              <p className="mt-4 text-sm leading-6 text-[#A8B7CB]">{product.includedSkills?.length ? "Le paiement est s\u00e9curis\u00e9 par SasPay. Les skills inclus seront activ\u00e9s dans votre espace membre apr\u00e8s confirmation." : product.isMemberSkill ? "Le paiement est s\u00e9curis\u00e9 par SasPay. Votre acc\u00e8s au skill sera activ\u00e9 dans votre espace membre apr\u00e8s confirmation du paiement." : "Le paiement est s\u00e9curis\u00e9 par SasPay. Votre t\u00e9l\u00e9chargement sera disponible dans votre compte apr\u00e8s confirmation du paiement."}</p>
              <Link href={`/checkout?product=${encodeURIComponent(product.slug)}`} className="mt-6 block w-full rounded-full bg-gradient-to-r from-[#397BFF] to-[#6557FF] px-4 py-3 text-center text-sm font-semibold text-white shadow-[0_8px_22px_rgba(57,123,255,.25)] transition hover:brightness-110">
                Payer
              </Link>
            </>
          ) : (
            <p className="mt-4 text-sm leading-6 text-[#A8B7CB]">Ce skill n’est pas encore disponible à l’achat. Revenez bientôt pour découvrir sa sortie.</p>
          )}
          <div className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#8F9CAE]">Historique des versions</h3>
            <ul className="mt-3 space-y-3 text-sm text-[#A8B7CB]">
              {product.versions.map((release) => (
                <li key={release.version} className="border-b border-[#24344F] pb-2 last:border-0">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-white">{release.version}</strong>
                    <span>{release.date}</span>
                  </div>
                  {release.notes.map((note) => (
                    <div key={note} className="mt-1 text-xs text-[#8F9CAE]">• {note}</div>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
      </div>
    </main>
  );
}
