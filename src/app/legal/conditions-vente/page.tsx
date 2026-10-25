import { LegalDocument } from "@/components/legal-document";
import { legalInformation } from "@/lib/legal-information";

export default function TermsOfSalePage() {
  return (
    <LegalDocument title="Conditions générales de vente">
      <section>
        <h2 className="text-xl font-semibold text-slate-900">Vendeur et produit</h2>
        <p>Le vendeur est HERVE QUENUM, entrepreneur individuel sous le statut de micro-entrepreneur, exploitant SkillFlow au Bénin. SkillFlow vend des skills numériques décrits sur leurs pages produit. Les mises à jour sont incluses dans les limites indiquées sur la page de l’offre achetée.</p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-slate-900">Prix et paiement</h2>
        <p>Le prix applicable est celui affiché sur la page du produit au moment de la commande. Le paiement est traité par SasPay en XOF. Vérifiez le montant et les frais éventuellement affichés par SasPay avant de confirmer le paiement.</p>
        <p>TVA : {legalInformation.vatStatus}.</p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-slate-900">Commande et livraison</h2>
        <p>Un compte SkillFlow est nécessaire. Après confirmation du paiement par SasPay, l’accès au produit numérique est activé dans le compte de l’acheteur. Une simple redirection vers la page de retour ne confirme pas le paiement.</p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-slate-900">Support, licence et remboursement</h2>
        <p>Pour une question sur une commande, écrivez à speedandsmart50@gmail.com en indiquant sa référence. La licence d’utilisation et la politique de remboursement font partie des documents liés ci-dessus.</p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-slate-900">Droit applicable</h2>
        <p>Le droit béninois s’applique. Tribunaux compétents : {legalInformation.competentCourts}.</p>
      </section>
    </LegalDocument>
  );
}
