# Deployment notes

## SasPay production checkout and private delivery

Checkout uses published catalogue prices and SasPay live credentials. Orders are
reconciled from verified webhooks, and paid customers can download the published
pack through short-lived signed URLs. Keep `SKILLFLOW_COMMERCE_ENABLED=false`
until you are ready to accept orders. Setting it to `true` opens checkout; it
does not complete legal information. Replace visible `[À COMPLÉTER]` markers
with verified details as soon as they are available.
Configure Supabase Auth with the production site URL and allowed redirect URLs.

### Google sign-in and account recovery

In Supabase Authentication > Providers, enable Google and enter the OAuth client
ID and secret from Google Cloud Console. In Google Cloud, add the Supabase
project's callback URL (`https://<project-ref>.supabase.co/auth/v1/callback`) as
an authorized redirect URI. In Supabase URL Configuration, set the production
site URL and allow `https://<your-domain>/auth/callback` and
`http://localhost:3000/auth/callback` for local development. The same callback
route exchanges Google sign-in and password recovery codes for a session.

For password recovery, enable email provider and set its recovery template link
to `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/auth/reset-password`.
The callback verifies this one-time token and returns the user to
`/auth/reset-password` to choose a new password. Google OAuth credentials and
Supabase provider settings are managed in their dashboards; they are not
application environment variables.

## SasPay onboarding as an individual

Complete identity verification in the SasPay dashboard using the account type
that truthfully matches your situation. The individual-account option describes
freelancers and independents collecting in their own name without a registered
entity. The SasPay account screen shown for this setup lists a limit of
1,000,000 XOF per month. Track monthly gross payments and confirm with SasPay how
refunds and fees count toward that limit. Confirm that downloadable AI skill packs
are accepted for the account and ask which payment methods, settlement rules, and
supporting documents apply after KYC. Do not split transactions or use another
person's account to work around a limit.
When the KYC tab shows that identity is verified, consider that identity step
complete; check the account or payment-activation status next rather than
resubmitting identity documents.

SasPay's [current terms](https://www.saspay.me/conditions-utilisation) describe it
as a technical integration layer. The underlying payment providers' terms also
apply, and the seller remains responsible for product delivery, customer disputes,
refunds, tax, and applicable consumer and data-protection obligations. Keep
checkout disabled until SasPay has approved the account and live credentials are
available.

1. Create a dedicated Vercel project for SkillFlow and deploy the `skillflow` directory.
2. Apply all SQL migrations in `supabase/migrations/` in numeric order, including `017_payment_reconciliation.sql` and `018_checkout_legal_acceptance.sql`, before enabling checkout.
3. Verify the production build with `npm run build`, then check the public catalogue.

The home page, `/shop`, product details, and `/api/products` read published,
non-archived products from Supabase. Apply the migrations before deployment.
Only products marked as available and carrying a published ZIP can be purchased.
Prices come from Supabase. The checkout return URL uses the configured canonical
application URL rather than the incoming request host.

The archive is excluded from Vercel and Git. After migration 003 creates the private
`product-packs` bucket, configure the service-role key in local `.env.local` and run
`npm run upload:product`. Verify the v1.0.0 archive is present in private Storage.

Configure `NEXT_PUBLIC_APP_URL` to the canonical HTTPS production origin,
`SUPABASE_SERVICE_ROLE_KEY`, a SasPay live `PAYIN` or `BOTH` key, and
`SASPAY_WEBHOOK_SECRET` as server-only deployment values. Assign the first
administrator manually from a trusted Supabase operator session after verifying
the account. Public signup and checkout cannot assign administrator access.

Before opening sales, replace every `[À COMPLÉTER]` marker in the legal pages,
publish the seller's legal identity and contact details, terms of sale, product
licence, refund policy, and privacy notice. Have the wording checked for the
seller's jurisdiction and the countries served. Confirm
SasPay's fees, supported markets, settlement currency, minimum payment, and webhook
configuration with the provider. Confirm the displayed price and tax treatment.
The site owner controls when to open checkout by setting
`SKILLFLOW_COMMERCE_ENABLED=true` in production. This switch does not validate
or fill in legal information; visible `[À COMPLÉTER]` markers remain the owner's
responsibility to replace with verified details.

## MCP connection

The Streamable HTTP MCP endpoint is `/api/mcp`. `list_skills` exposes public
catalogue metadata. Bundled free skills are available with `get_skill`. Paid
packs require a valid customer MCP key in `Authorization: Bearer <key>` and an
active entitlement; `get_skill` then returns a short-lived signed link to the
private ZIP. MCP keys are stored as SHA-256 hashes and can be revoked from the
customer account.

- For a local desktop MCP client, use `http://localhost:3000/api/mcp` while `npm run dev`
  is running.
- For Claude or ChatGPT connecting to a deployed service, use the public HTTPS URL
  `https://<your-domain>/api/mcp`. A localhost URL is not reachable by hosted services.
- Start with the client’s remote MCP/custom connector flow and add that URL. The exact
  setup screens depend on the client and account configuration.

The endpoint can be reached without a key for public catalogue metadata and free
bundled skills. Never return customer-specific content or private files without
validating both the MCP key and the purchaser's active entitlement.

## Pre-deployment validation

1. Run `npm test`, `npm run lint`, and `npm run build`.
2. Verify sign-up, email confirmation, and sign-in using the deployed Supabase Auth URLs.
3. Run one authorized live payment, then verify webhook reconciliation, account order status,
   and the short-lived signed download.

Do not treat a redirect to the completion page or webhook payload alone as proof
of payment. The webhook, customer return, cron, and manual recovery all verify
the payment with SasPay before the shared database activation routine grants access.

## SasPay reconciliation and manual recovery

Configure this webhook URL in the SasPay dashboard:
`https://skillflow-sigma.vercel.app/api/webhooks/saspay` (use the same path on the
canonical custom domain if different). Confirm SasPay sends `x-webhook-signature`,
`x-webhook-timestamp`, `x-webhook-event`, and the `transaction.success` /
`transaction.failed` format expected by the integration.

Production environment variables: `NEXT_PUBLIC_APP_URL`, `SASPAY_API_URL`,
`SASPAY_CHECKOUT_SESSION_STATUS_PATH` (GET path template; default
`/checkout-sessions/{id}/`),
live `SASPAY_API_KEY`, `SASPAY_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`,
`CRON_SECRET`, and `SKILLFLOW_COMMERCE_ENABLED`. The commerce flag controls
whether checkout is open. Keep it `false` until the owner is ready to accept
orders; setting it to `true` does not complete legal markers or verify a live
purchase.
The checkout records the server timestamp in `orders.terms_accepted_at` after
the buyer accepts the conditions of sale, skill licence, and refund policy.

This Vercel project uses the Hobby plan, whose cron jobs can run once per day.
`vercel.json` schedules reconciliation at 08:00 UTC; Hobby may invoke it at any
time in that hour. The job checks pending or recently closed orders aged 2 minutes
to 48 hours, including late provider confirmations. Set a random `CRON_SECRET` in
Vercel. Vercel adds `Authorization: Bearer <CRON_SECRET>` to its scheduled call.

For checks every five minutes without upgrading the Vercel plan, configure an
external scheduler such as cron-job.org to call
`https://skillflow-sigma.vercel.app/api/cron/saspay-reconcile` every five minutes.
Add the HTTP header `Authorization: Bearer <CRON_SECRET>` in that scheduler and
store the same secret there as a protected value. Never put it in the URL, source
code, or a committed file. The route returns 401 when the secret is absent or
does not match.

For manual recovery, put a short-lived administrator Supabase access token in
`SKILLFLOW_ADMIN_ACCESS_TOKEN` in `.env.local`. Run
`npm run payments:reconcile -- --reference "SkillFlow order <UUID>"` to inspect
local and SasPay status, or add `--activate` to reconcile after provider
confirmation. Use `--email <address>` to list that account's orders. The command
does not grant access based only on an operator assertion.

Before launch, the owner should run one live purchase at the smallest amount
SasPay permits, confirm the durable webhook log and immediate account activation,
then leave a second authorized order pending until a scheduled cron run to verify
recovery from a missed webhook. Do not run a live payment as part of automated
tests or deployment verification.
