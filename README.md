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
`SKILLFLOW_COMMERCE_ENABLED=false` until the seller details, terms, licence,
refund policy, privacy notice, Supabase setup, SasPay webhook, and private
product archive are ready. Set it to `true` only after those launch checks pass.

Administrator access is assigned manually by a trusted operator. A public
checkout or coupon can never grant this role. `BOOST` leaves the purchaser with
the client role. Clients can download the private v1.0.0 archive from their
account using a short-lived signed URL.

Follow [docs/deployment.md](./docs/deployment.md) to apply migrations in order,
upload the archive to private Supabase Storage, configure the production webhook,
and validate the account and purchase flow. A redirect alone never confirms payment;
the signed webhook and server-side transaction verification do.

## Lancer le projet

Installez les dépendances, configurez les variables d’environnement décrites
plus haut, puis démarrez le serveur de développement :

```bash
npm run dev
```

Le site est accessible à l’adresse [http://localhost:3000](http://localhost:3000).
Les polices utilisées sont Bricolage Grotesque et Instrument Sans.
