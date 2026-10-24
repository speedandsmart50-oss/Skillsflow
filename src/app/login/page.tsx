export default function LoginPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Bientôt disponible</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Connexion bientôt disponible</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">L&apos;espace client est en cours de préparation. La connexion n&apos;est pas encore activée.</p>
        <form className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
            <input disabled type="email" placeholder="hello@company.com" className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Password</label>
            <input disabled type="password" placeholder="••••••••" className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60" />
          </div>
          <button type="button" disabled className="w-full cursor-not-allowed rounded-full bg-slate-400 px-4 py-3 text-sm font-semibold text-white">
            Connexion indisponible
          </button>
        </form>
      </div>
    </main>
  );
}
