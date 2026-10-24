import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-300">
        Accès refusé
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
        Cette page est réservée à l’équipe SkillFlow.
      </h1>
      <p className="mt-4 max-w-lg text-base leading-7 text-slate-300">
        Votre compte ne dispose pas des droits nécessaires pour consulter cette page.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-full bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200"
      >
        Retour à l’accueil
      </Link>
    </main>
  );
}
