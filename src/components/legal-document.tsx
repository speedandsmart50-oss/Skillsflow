import Link from "next/link";
import type { ReactNode } from "react";

const documents = [
  ["Toutes les informations", "/legal"],
  ["Mentions légales", "/legal/mentions-legales"],
  ["Conditions de vente", "/legal/conditions-vente"],
  ["Licence", "/legal/licence"],
  ["Remboursement", "/legal/remboursement"],
  ["Confidentialité", "/legal/confidentialite"],
] as const;

export function LegalDocument({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="min-h-[70vh] bg-white px-4 py-12 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-800">SkillFlow · Informations légales</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">{title}</h1>
        <nav aria-label="Documents légaux" className="mt-7 border-y border-slate-200 py-4">
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {documents.map(([label, href]) => (
              <li key={href}><Link href={href} className="text-cyan-800 underline underline-offset-4 hover:text-cyan-950">{label}</Link></li>
            ))}
          </ul>
        </nav>
        <article className="mt-8 space-y-6 leading-7 text-slate-700">
          {children}
          <p>
            Contact : <a className="text-cyan-800 underline underline-offset-4" href="mailto:speedandsmart50@gmail.com">speedandsmart50@gmail.com</a>
          </p>
        </article>
      </div>
    </main>
  );
}
