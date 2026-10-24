export default function LegalPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">Ouverture pilote réservée</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">Informations et conditions</h1>
      <div className="mt-8 space-y-5 leading-7 text-slate-600">
        <p>
          SkillFlow accepte actuellement un paiement pilote réservé au compte autorisé.
          Le paiement est traité par SasPay et le téléchargement du pack est remis depuis
          un stockage privé après confirmation du paiement.
        </p>
        <p>
          Les ventes publiques ne doivent pas être ouvertes avant publication de
          l’identité et des coordonnées de l’éditeur, des conditions de vente, des règles
          de licence et de remboursement, et des informations de confidentialité correspondant
          aux services réellement utilisés.
        </p>
        <p>
          Les mentions définitives doivent être vérifiées au regard de la situation
          de l’activité et des règles applicables au Bénin et aux pays desservis.
        </p>
      </div>
    </main>
  );
}
