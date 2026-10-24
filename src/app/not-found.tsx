import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">404</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">Skill not found</h1>
      <p className="mt-4 text-slate-600">The requested package may have been removed or its URL may be incorrect.</p>
      <Link href="/shop" className="mt-6 inline-flex rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700">
        Return to the catalog
      </Link>
    </main>
  );
}
