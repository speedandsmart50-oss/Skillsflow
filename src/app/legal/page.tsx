import Link from "next/link";
import { LegalDocument } from "@/components/legal-document";
import { hasUncompletedLegalInformation } from "@/lib/legal-information";

const documents = [
  ["Mentions légales", "/legal/mentions-legales"],
  ["Conditions générales de vente", "/legal/conditions-vente"],
  ["Licence d’utilisation", "/legal/licence"],
  ["Politique de remboursement", "/legal/remboursement"],
  ["Politique de confidentialité", "/legal/confidentialite"],
] as const;

export default function LegalIndexPage() {
  const hasPlaceholders = hasUncompletedLegalInformation();
  return (
    <LegalDocument title="Informations légales">
      <p>Consultez les documents applicables à l’utilisation et à l’achat des skills Skillsflow.</p>
      {hasPlaceholders && (
        <p role="status" className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-amber-100">
          Certains renseignements portent la mention [À COMPLÉTER]. Ils doivent être renseignés avant l’ouverture des ventes.
        </p>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {documents.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="block rounded-xl border border-[#24344F] bg-[#111A2B] p-4 font-semibold text-[#70E9F5] underline underline-offset-4 transition hover:border-[#20DDF2]/50 hover:text-white">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </LegalDocument>
  );
}
