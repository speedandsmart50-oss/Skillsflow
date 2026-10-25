# SkillFlow

SkillFlow propose des compétences prêtes à l’emploi pour les assistants IA. Le
projet comprend un catalogue, un espace client, une interface d’administration,
un paiement SasPay et un serveur MCP.

## SkillFlow MCP connector

The Streamable HTTP MCP endpoint is available at `/api/mcp` and accepts `POST`
requests. Configure Claude or another MCP client with the deployed URL
`https://<your-domain>/api/mcp`.

The `list_skills` tool searches the bundled free Go Pro skills and published
catalogue products. The free bundled skills can be retrieved with `get_skill`.
For a paid pack, create an MCP key from the customer account and configure it as
`Authorization: Bearer <key>` in the MCP client. After a confirmed purchase,
`get_skill` returns a private ZIP link that expires after 10 minutes.

## Supabase

Install dependencies and copy `.env.example` to `.env.local`. Set
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the
selected Supabase project's API settings. Apply the SQL migrations in order.

The client is created by `getSupabaseClient()` in
`src/lib/supabase/client.ts`; it throws a clear error if either variable is
missing. Only the public anon/publishable key belongs in these variables.
Never expose a Supabase service-role key to browser code.

## Production checkout and delivery

Public checkout uses each published product's catalogue price. SasPay accepts
live keys beginning with `sk_live_`. Configure its API key and webhook secret,
the Supabase service-role key, and `NEXT_PUBLIC_APP_URL` in the deployment
environment. Never expose server-only values with a `NEXT_PUBLIC_` prefix.

`BOOST` deducts 10 EUR where the product price permits it. Keep
`SKILLFLOW_COMMERCE_ENABLED=false` until you are ready to accept orders. Setting
it to `true` opens checkout; it does not complete legal information. Any visible
`[À COMPLÉTER]` marker in the legal pages must be replaced with verified details
by the site owner.

Administrator access is assigned manually by a trusted operator. A public
checkout or coupon can never grant this role. `BOOST` leaves the purchaser with
the client role. Clients can download the private v1.0.0 archive from their
account using a short-lived signed URL.

Follow [docs/deployment.md](./docs/deployment.md) to apply migrations in order,
upload the archive to private Supabase Storage, configure the production webhook,
and validate the account and purchase flow. A redirect alone never confirms payment;
the signed webhook and server-side transaction verification do.

### Paiements SasPay : réconciliation et secours

- URL du webhook à enregistrer :
  `https://skillflow-sigma.vercel.app/api/webhooks/saspay` (utilisez le domaine
  canonique correspondant à `NEXT_PUBLIC_APP_URL`).
- Variables serveur requises : `SASPAY_API_KEY` (clé `sk_live_`),
  `SASPAY_API_URL`, `SASPAY_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`,
  `NEXT_PUBLIC_APP_URL`, `CRON_SECRET` et `SKILLFLOW_COMMERCE_ENABLED=true`.
  `SASPAY_CHECKOUT_SESSION_STATUS_PATH` configure le chemin GET de statut de
  session SasPay (par défaut `/checkout-sessions/{id}/`) et doit contenir `{id}`.
- Appliquez les migrations dans l’ordre numérique. Les migrations 017 et 018
  ajoutent la réconciliation des paiements et l’horodatage de l’acceptation des
  documents légaux. Le webhook attendu envoie `x-webhook-signature`,
  `x-webhook-timestamp`, `x-webhook-event` et les événements
  `transaction.success` / `transaction.failed` compatibles avec l’intégration.
- Sur le plan Hobby, Vercel exécute le cron une fois par jour à 08:00 UTC
  (l’heure réelle peut varier dans cette heure). Pour une vérification toutes les
  cinq minutes, configurez un ordonnanceur externe, par exemple cron-job.org,
  vers `https://skillflow-sigma.vercel.app/api/cron/saspay-reconcile` avec
  l’en-tête `Authorization: Bearer <CRON_SECRET>`. Gardez cette valeur secrète
  dans l’ordonnanceur et Vercel. Définissez `CRON_SECRET` en production. La tâche vérifie auprès de SasPay les
  commandes en attente ou récemment clôturées âgées de 2 minutes à 48 heures,
  afin de récupérer aussi les confirmations tardives du fournisseur. Un appel
  sans le bon en-tête reçoit une réponse 401.
- Le formulaire de paiement exige l’acceptation des conditions de vente, de la
  licence et de la politique de remboursement. Le serveur vérifie ce choix et
  enregistre `terms_accepted_at` sur la commande.
- `SKILLFLOW_COMMERCE_ENABLED` contrôle l'ouverture du checkout : `false` le
  bloque et `true` l'ouvre. Ce réglage ne complète pas les mentions légales ;
  remplacez chaque marqueur `[À COMPLÉTER]` par une information vérifiée.
- Pour l’inspection ou le secours, utilisez un jeton Supabase de courte durée
  appartenant à un administrateur : placez-le dans
  `SKILLFLOW_ADMIN_ACCESS_TOKEN` de `.env.local`, puis lancez :

  ```bash
  npm run payments:reconcile -- --reference "SkillFlow order <UUID>"
  npm run payments:reconcile -- --email client@example.com
  npm run payments:reconcile -- --reference "SkillFlow order <UUID>" --activate
  ```

  `--activate` ne donne jamais accès sans confirmation du paiement par SasPay.
  Les corps bruts reçus (et en-têtes non sensibles) ainsi que les décisions de
  réconciliation sont conservés 90 jours dans des tables privées réservées au serveur.

## Lancer le projet

Installez les dépendances, configurez les variables d’environnement décrites
plus haut, puis démarrez le serveur de développement :

```bash
npm run dev
```

Le site est accessible à l’adresse [http://localhost:3000](http://localhost:3000).
Les polices utilisées sont Bricolage Grotesque et Instrument Sans.
