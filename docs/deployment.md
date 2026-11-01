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
For paid-feature access, set the server-only `SKILLFLOW_ADMIN_EMAIL` to the
verified administrator's exact email and ensure that account's `profiles.role`
is `admin` in Supabase. The admin role is required by database RPCs and row-level
security; the configured email is also checked by server routes. This grants
access to paid packs and subscription-gated member features without creating
purchase, payment, or subscription records.

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

## Inbound messaging foundation

The messaging module is being introduced in gated phases. Keep
`MESSAGING_ENABLED=false` and `DRY_RUN=true` until the channel integrations,
policies, and owner-approved test setup are complete. Phase 3 adds only an
admin-owned WhatsApp inbound webhook at `/api/webhooks/whatsapp`; it does not
send messages or expose messaging tools or an inbox UI. The route returns 404
while messaging is disabled. When enabled, configure the server-only
`META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
`WHATSAPP_BUSINESS_ACCOUNT_ID`, and `SKILLFLOW_ADMIN_EMAIL` values. The POST
handler verifies Meta's HMAC-SHA256 signature over the raw body, enforces a 1
MiB request limit, checks the configured business-account and phone-number IDs,
and places normalized events
in an asynchronous, idempotent queue. The inbox is assigned to the profile
whose email matches `SKILLFLOW_ADMIN_EMAIL` and whose `profiles.role` is
`admin`; it is not shared with all members. Exact opt-out commands (`STOP`,
`STOP ALL`, `UNSUBSCRIBE`,
`CANCEL`, `END`, `QUIT`, and `ARRET`) mark the contact opted out. No webhook
handler sends a reply. Never add channel credentials to Git or browser-exposed
environment variables.

See Meta's current [WhatsApp webhook endpoint guide](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint)
for the verification, signature, response, and retry protocol. Verified event
data is stored only after signature validation. The current processor uses
Next.js `after()` with a bounded queue claim; a scheduled recovery worker and
automated expired-event cleanup are not configured yet. Keep messaging disabled
in production until durable recovery and cleanup are operational.

Migration `049_inbound_messaging.sql` adds owner-scoped message, contact,
follow-up, and audit tables. Its matching rollback is kept outside the forward
migration directory at `supabase/rollback/049_inbound_messaging.down.sql`.
Migration `050_whatsapp_webhook_queue.sql` adds the isolated webhook queue and
server-only processing functions; its rollback is
`supabase/rollback/050_whatsapp_webhook_queue.down.sql`. Processed queue records
have their normalized payload cleared; pending or failed records have a
seven-day expiry timestamp. Configure an operational cleanup before enabling
the webhook in production. Neither migration has been applied to a persistent
database; do not apply either migration to production without the owner's
explicit approval.

Phase 4 adds `supabase/migrations/051_messaging_send_rules.sql` and its matching
rollback. The server-only `canSend` gate records allowed and refused decisions,
and creates a draft/reservation only when all checks pass. It requires a
recorded, timestamped opt-in with a non-empty source; receiving an inbound
message does not grant consent. Free-form WhatsApp messages are refused at or
after the exact 24-hour customer-service-window boundary. Outside that window,
only an approved template whose provider ID and approval were verified within
the previous 24 hours is eligible. No template synchronization or sender exists
yet, so template sends remain unavailable and Phase 4 performs no sending.
Messenger and Instagram sends are refused because their policies have not been
implemented.

The database serializes send decisions before applying rolling global hourly,
UTC contact-daily, and 24-hour exact-content duplicate limits. Defaults are
`MAX_OUTBOUND_PER_CONTACT_PER_DAY=3` and `MAX_OUTBOUND_PER_HOUR=50`; invalid or
out-of-range values fail explicitly. The audit log records the decision reason
and message metadata, not message content. These rules do not replace review of
consent and privacy obligations in each recipient's jurisdiction.

Keep the production messaging flag disabled until the remaining phases,
durable queue recovery, and cleanup are complete. Migration 051 has not been
applied to a persistent database; do not apply it without the owner's explicit
approval.

Phase 5 adds a WhatsApp Cloud API adapter and an authorized send coordinator.
The coordinator calls `canSend` first and never invokes the adapter for refused
decisions or dry-run drafts. Live sends additionally require both
`DRY_RUN=false` and `WHATSAPP_LIVE_SENDS_ENABLED=true`, as well as a configured
WhatsApp access token, phone-number ID, and explicit Graph API version. The
live-send flag defaults to `false` and must remain off until separate owner
approval and a dedicated test number are provided. This phase did not perform
any provider calls.

The adapter uses the stored contact's WhatsApp ID, sends text or registered
template payloads without template variables, and stores the provider message
ID/status. It makes at most three attempts on explicit HTTP 429 responses,
using bounded backoff or a short `Retry-After`; it does not retry network
errors or other HTTP failures because the provider may already have accepted a
request. Delivery/read/failure updates continue to come from the signed
webhook. This sender is not yet exposed via MCP or an inbox.

Phase 6 registers administrator-only MCP tools only when `MESSAGING_ENABLED=true` and the
MCP caller is authenticated: list WhatsApp contacts, read a contact's recent
conversation, and send a WhatsApp reply. Every operation checks that the
caller profile is an administrator and that its email exactly matches
`SKILLFLOW_ADMIN_EMAIL`; ordinary members are denied. Conversation and send
inputs use a stored SkillFlow contact UUID, never a free-form recipient number.
The send tool delegates to the same `canSend` gate and sender as the server
module. MCP usage logs include contact IDs, message length, and outcomes, not
message text. Keep the module disabled until the admin profile, opt-in records,
and queue recovery/cleanup are configured.
Phase 8 extends only the list/read tools to include Messenger and Instagram
contacts and conversations; sending remains WhatsApp-only.

Phase 7 adds draft-first WhatsApp follow-ups through migration
`052_messaging_followup_scheduler.sql`; its rollback is
`supabase/rollback/052_messaging_followup_scheduler.down.sql`. Creating a
follow-up never schedules it immediately: an administrator must approve the
follow-up draft. Its due time is transparently offset by a recorded random
0–900 seconds (`jitter_seconds`) to distribute worker load; this is not an
evasion feature. At processing time, the worker re-runs the same consent,
24-hour window/template, rate-limit, and duplicate checks used for manual
messages. A dry-run creates a separate message draft that needs explicit
approval and a fresh policy check before any send. Ambiguous failures and
expired claims require manual review and are never automatically retried.

The existing Vercel Hobby cron runs only daily and is not suitable for this
queue. Configure an external scheduler to call
`/api/cron/messaging-followups` every five minutes with
`Authorization: Bearer <CRON_SECRET>`. Keep the request limited to that cadence;
each invocation claims at most five due follow-ups. Configure `CRON_SECRET` as a
server-only value. Do not rely on the daily `vercel.json` job for follow-up
timing. Migration 052 has not been applied to a persistent database; do not
apply it without the owner's explicit approval. Keep `MESSAGING_ENABLED=false`,
`DRY_RUN=true`, and `WHATSAPP_LIVE_SENDS_ENABLED=false` until operational
recovery, opt-in, administrator approval, and dedicated live-send readiness
have been reviewed.

Phase 8 adds **inbound Facebook Page Messenger and Instagram Professional
Messaging only** at `/api/webhooks/messenger` and `/api/webhooks/instagram`.
Both routes share the Meta raw-body signature and verification checks, a 1 MiB
request bound, strict configured Page/account ID matching, asynchronous
durable processing, and idempotent message storage. Echoes, deletions, and
non-message notifications are ignored; supported non-text messages are stored
without copying media payloads or URLs. Exact opt-out commands mark the
contact opted out. Inbound messages never grant marketing consent. This phase
adds no Messenger or Instagram sender and no automated reply. MCP contact and
conversation reads can select WhatsApp, Messenger, or Instagram; outbound
sending remains WhatsApp-only.

Configure the Meta Webhooks product for the `Page` object and subscribe the
Page to `messages` for Messenger. For Instagram, connect the Professional
account to the associated Page and subscribe the Instagram messaging app to
the `messages` webhook field. The Instagram Messaging API requires
`instagram_basic`, `instagram_manage_messages`, and `pages_manage_metadata`.
Meta currently requires a published app; Standard Access is limited to app-role
testers, and customer events generally require Advanced Access/App Review and
the user's granted permissions. Meta also instructs businesses to subscribe
all messaging apps to messaging webhooks. Event processing is queued after
signature and payload validation so the endpoint can promptly return HTTP 200.
The standard response window is generally 24 hours, with specific exceptions;
this intake-only phase does not implement exceptions or sending policy.

Keep all messaging flags disabled until the operator has reviewed platform
access, permissions, privacy obligations, retention, and webhook subscriptions.
Apply migration 053 for Messenger and 054 for Instagram only after explicit
approval and in numeric order after 049–052. Each rollback refuses to narrow
the shared queue while events for that channel remain retained.

References: Meta [Messenger Webhooks](https://developers.facebook.com/documentation/business-messaging/messenger-platform/webhooks),
[Instagram Messaging Webhooks](https://developers.facebook.com/documentation/business-messaging/instagram-messaging/webhooks),
and [Messenger/Instagram Messaging policy](https://developers.facebook.com/documentation/business-messaging/messenger-platform/policy).

## Phase 9: internal growth indicators and reminders

Migration `055_growth_metrics_and_reminders.sql` adds administrator-only,
internal reminder drafts and aggregate read-only metrics. Its rollback is
`supabase/rollback/055_growth_metrics_and_reminders.down.sql`. Apply it only
after migrations 049–054 and only with the owner's explicit approval. It has
been applied to the confirmed staging project; production must not be migrated
without separate approval.

The MCP tools are registered only when `GROWTH_ENABLED=true` and still require
an authenticated caller whose profile is the configured administrator. Metrics
contain counts only, not conversation text or recipient details. Reminder drafts
may be listed, completed, or cancelled, but do not send messages, publish
content, call external services, or schedule a delivery. Keep
`GROWTH_ENABLED=false` and `GROWTH_PUBLISHING_ENABLED=false` until reviewed.
The publishing flag does not enable any publishing tools in this phase.

The Prospection page has a separate member-facing dashboard backed by migration
`056_prospection_reminders.sql` and its rollback
`supabase/rollback/056_prospection_reminders.down.sql`. It is limited to members
with an active Prospection subscription, plus the configured administrator,
and stores reminders against that user's own prospects. Its indicators are
computed only from that user's prospects and reminders; they do not include or
expose administrator-owned WhatsApp, Messenger, or Instagram conversations.
Reminders are internal checklists only and have no delivery or notification
integration. Migration 056 is applied to the confirmed staging project, not
production.

Migration `057_admin_paid_access.sql` additionally grants administrator
accounts access to paid-member feature checks without creating a fabricated
subscription. It is also applied to staging and is not approved for production.

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
