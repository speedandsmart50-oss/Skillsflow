# Deployment notes

## SasPay production checkout and private delivery

Checkout uses published catalogue prices and SasPay live credentials. Orders are
reconciled from verified webhooks, and paid customers can download the published
pack through short-lived signed URLs. Keep `SKILLFLOW_COMMERCE_ENABLED=false`
until all launch requirements below are complete.
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
2. Apply migrations `001_init.sql` through `010_catalog_and_personal_agent_data.sql` in numeric order, then `011_skills_library_and_member_agents.sql`. The 011 migration seeds 15 categories and 30 Skills, creates member/agent tables and RLS, and must be applied before opening `/member` or using private MCP tools.
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

Before opening sales, publish the seller's legal identity and contact details,
terms of sale, product licence, refund/withdrawal policy, and privacy notice. Have
the wording checked for the seller's jurisdiction and the countries served. Confirm
SasPay's fees, supported markets, settlement currency, minimum payment, and webhook
configuration with the provider. Confirm the displayed price and tax treatment.
Only then set `SKILLFLOW_COMMERCE_ENABLED=true` in production.

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

Do not treat a redirect to the completion page as proof of payment. Only the verified
SasPay webhook changes order status and unlocks a download.
