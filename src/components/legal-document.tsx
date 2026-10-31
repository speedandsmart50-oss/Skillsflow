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
    <main className="min-h-[70vh] bg-[#0d1321] px-4 py-12 text-[#C5D3E2] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#70E9F5]">Skillsflow · Informations légales</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">{title}</h1>
        <nav aria-label="Documents légaux" className="mt-7 border-y border-[#24344F] py-4">
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {documents.map(([label, href]) => (
              <li key={href}><Link href={href} className="text-[#70E9F5] underline underline-offset-4 hover:text-white">{label}</Link></li>
            ))}
          </ul>
        </nav>
        <article className="mt-8 space-y-6 leading-7 text-[#C5D3E2] [&_a]:text-[#70E9F5] [&_a]:underline [&_a]:underline-offset-4 [&_h2]:text-white [&_h3]:text-white [&_strong]:text-white">
          {children}
          <p>
            Contact : <a href="mailto:speedandsmart50@gmail.com">speedandsmart50@gmail.com</a>
          </p>
        </article>
      </div>
    </main>
  );
}
