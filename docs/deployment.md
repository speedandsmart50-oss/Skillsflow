# Deployment notes

## Public vitrine

The current release can be deployed as a public product catalogue. Payments, sign-in,
customer downloads, and admin pages remain unavailable; checkout and webhook endpoints
return `503` until order persistence, payment reconciliation, and authentication are
implemented. Do not enable live SasPay credentials as a substitute for those features.

1. Create a dedicated Vercel project for SkillFlow and deploy the `skillflow` directory.
2. A custom domain is optional; use the Vercel-provided domain until a registered domain is configured.
3. Verify the production build with `npm run build`, then check the public catalogue and
   confirm checkout remains unavailable.

## Enabling commerce later

1. Configure a Supabase project dedicated to SkillFlow.
2. Apply `supabase/migrations/001_init.sql` and implement authentication and private downloads.
3. Implement persistent orders and reconcile signed SasPay webhooks before enabling checkout.
4. Add production environment variables from `.env.example` in Vercel, and set the SasPay
   webhook URL to the deployed `/api/webhooks/saspay` endpoint.
