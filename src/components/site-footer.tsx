import Link from "next/link";
import { ElectricLogo } from "@/components/electric-icons";

export function SiteFooter() {
  return (
    <footer className="app-shell-chrome border-t border-[#1E2B4C]/60 bg-[#0B1020]">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-3 lg:px-8">
        <div>
          <Link href="/" aria-label="Skillsflow, accueil" className="site-logo mb-3 inline-flex text-white">
            <ElectricLogo />
          </Link>
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
              Informations légales
            </Link>
            <Link href="/legal/mentions-legales" className="block hover:text-white">
              Mentions légales
            </Link>
            <Link href="/legal/conditions-vente" className="block hover:text-white">
              Conditions de vente
            </Link>
            <Link href="/legal/licence" className="block hover:text-white">
              Licence des skills
            </Link>
            <Link href="/legal/remboursement" className="block hover:text-white">
              Remboursements
            </Link>
            <Link href="/legal/confidentialite" className="block hover:text-white">
              Confidentialité
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
