# Deployment notes

## SasPay production checkout and private delivery

Checkout uses SasPay live credentials only. Orders are reconciled from verified webhooks,
and paid customers can download the published pack through short-lived signed URLs.
Configure a SasPay live `PAYIN` or `BOTH` key, the webhook secret, and server-side
Supabase credentials in production.
Configure Supabase Auth with the production site URL and allowed redirect URLs.

1. Create a dedicated Vercel project for SkillFlow and deploy the `skillflow` directory.
2. Apply migrations `001_init.sql`, `002_sandbox_commerce.sql`, and `003_production_launch.sql` in order.
3. Verify the production build with `npm run build`, then check the public catalogue.

The archive is excluded from Vercel and Git. After migration 003 creates the private
`product-packs` bucket, configure the service-role key in local `.env.local` and run
`npm run upload:product`. Verify the v1.0.0 archive is present in private Storage.

The live pilot costs 280 XOF and is restricted to the verified `SKILLFLOW_ADMIN_EMAIL`
account. It approximates USD 0.50; verify conversion and provider minimum with SasPay.
`BOOST` is disabled during the pilot. After it succeeds, set
`INITIAL_LIVE_TRIAL_PRICE_XOF` to `null` in `src/lib/pricing.ts` to restore the
39 EUR price and `BOOST` discount. Keep `SKILLFLOW_ADMIN_EMAIL` set: `ADMIN` grants
admin access only to that verified account after successful payment. Complete the
seller identity, terms, licence, refund policy, and privacy notice before public sales.

## MCP connection

The read-only MCP endpoint is `/api/mcp`. It uses Streamable HTTP and exposes the
published catalogue through `list_skills` and `get_skill`; it does not expose checkout,
private downloads, or unpublished products.

- For a local desktop MCP client, use `http://localhost:3000/api/mcp` while `npm run dev`
  is running.
- For Claude or ChatGPT connecting to a deployed service, use the public HTTPS URL
  `https://<your-domain>/api/mcp`. A localhost URL is not reachable by hosted services.
- Start with the client’s remote MCP/custom connector flow and add that URL. The exact
  setup screens depend on the client and account configuration.

The catalogue is public, so this initial MCP endpoint does not require authentication.
Do not add customer-specific actions or private data without implementing authentication
and authorization first.

## Pre-deployment validation

1. Run `npm test`, `npm run lint`, and `npm run build`.
2. Verify sign-up, email confirmation, and sign-in using the deployed Supabase Auth URLs.
3. Run one authorized live payment, then verify webhook reconciliation, account order status,
   and the short-lived signed download.

Do not treat a redirect to the completion page as proof of payment. Only the verified
SasPay webhook changes order status and unlocks a download.
