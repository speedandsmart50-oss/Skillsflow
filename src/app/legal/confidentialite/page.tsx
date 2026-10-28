import { LegalDocument } from "@/components/legal-document";
import { legalInformation } from "@/lib/legal-information";

export default function PrivacyPolicyPage() {
  return (
    <LegalDocument title="Politique de confidentialité">
      <section>
        <h2 className="text-xl font-semibold text-slate-900">Données utilisées</h2>
        <p>Skillsflow traite l’adresse e-mail du compte, les informations de commande ainsi que les journaux de paiement et de webhook. Ces données servent à gérer le compte et les commandes, vérifier les paiements, fournir l’accès acheté et répondre aux demandes de support.</p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-slate-900">Prestataires</h2>
        <p>Les prestataires utilisés pour le service sont Supabase, Vercel et SasPay. SasPay traite le paiement. Supabase héberge les données de compte et de commande ; Vercel héberge l’application Skillsflow.</p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-slate-900">Durées de conservation</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>Données de compte et e-mail : {legalInformation.accountRetention}.</li>
          <li>Informations de commande : {legalInformation.orderRetention}.</li>
          <li>Journaux de paiement et de webhook : {legalInformation.paymentLogRetention}.</li>
        </ul>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-slate-900">Vos demandes</h2>
        <p>Vous pouvez demander l’accès à vos données ou leur suppression en écrivant à speedandsmart50@gmail.com depuis l’adresse liée à votre compte. Indiquez clairement votre demande et les informations nécessaires pour retrouver le compte ou la commande concernée.</p>
      </section>
    </LegalDocument>
  );
}
