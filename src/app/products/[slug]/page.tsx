import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug, products } from "@/features/products/products";

export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/shop" className="mb-6 inline-flex text-sm font-medium text-slate-600 hover:text-slate-900">
        ← Back to catalog
      </Link>
      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-4 flex items-center justify-between gap-4">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
              {product.status}
            </span>
            <span className="text-sm font-medium text-slate-500">v{product.version}</span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">{product.name}</h1>
          <p className="mt-4 text-lg text-slate-600">{product.tagline}</p>
          <p className="mt-6 text-base leading-7 text-slate-600">{product.description}</p>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Problem solved</h2>
              <p className="mt-3 text-slate-600">{product.problem}</p>
            </div>
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Compatible agents</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {product.compatibleAgents.map((agent) => (
                  <span key={agent} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700">
                    {agent}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Install checklist</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-6 text-slate-600">
              {product.installSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        </section>

        <aside className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
          <div className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Purchase</div>
          <div className="mt-4 text-4xl font-semibold text-slate-900">€{product.price}</div>
          <button disabled className="mt-6 w-full cursor-not-allowed rounded-full bg-slate-300 px-4 py-3 text-sm font-semibold text-slate-600">
            Purchases opening soon
          </button>
          <div className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Version history</h3>
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
