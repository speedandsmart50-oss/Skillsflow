import { LegalDocument } from "@/components/legal-document";
import { legalInformation } from "@/lib/legal-information";

export default function LegalNoticePage() {
  return (
    <LegalDocument title="Mentions légales">
      <section>
        <h2 className="text-xl font-semibold text-slate-900">Éditeur du site</h2>
        <p>Skillsflow est exploité par HERVE QUENUM, entrepreneur individuel exerçant sous le statut de micro-entrepreneur, au Bénin.</p>
        <p>Adresse : {legalInformation.address}</p>
        <p>Numéro d’identification : IFU 0202334766963.</p>
        <p>Contact : speedandsmart50@gmail.com.</p>
        <p>Responsable de la publication : Hervé Quenum.</p>
        <p>TVA : {legalInformation.vatStatus}.</p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-slate-900">Hébergement</h2>
        <p>Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis.</p>
      </section>
    </LegalDocument>
  );
}
