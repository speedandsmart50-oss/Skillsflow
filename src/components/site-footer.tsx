import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="app-shell-chrome border-t border-cyan-400/10 bg-[#070e1b]">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-3 lg:px-8">
        <div>
          <div className="mb-3 text-[2rem] font-bold tracking-[-0.06em] text-white">SkillFlow</div>
          <p className="max-w-xs text-[1.05rem] leading-7 text-slate-400">
            Des compétences IA pratiques, transparentes et conçues pour différents assistants.
          </p>
        </div>

        <div>
          <h3 className="mb-4 text-[1.05rem] font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Catalogue
          </h3>
          <div className="space-y-3 text-[1.05rem] text-slate-400">
            <Link href="/shop" className="block hover:text-white">
              Découvrir le skill
            </Link>
          </div>
        </div>

        <div>
          <h3 className="mb-4 text-[1.05rem] font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Informations
          </h3>
          <div className="space-y-3 text-[1.05rem] text-slate-400">
            <Link href="/legal" className="block hover:text-white">
              Mentions et confidentialité
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
