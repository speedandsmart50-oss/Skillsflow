This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## SkillFlow MCP connector

The Streamable HTTP MCP endpoint is available at `/api/mcp` and accepts `POST`
requests. Configure Claude or another MCP client with the deployed URL
`https://<your-domain>/api/mcp`.

The `list_skills` tool searches the bundled Go Pro skills and published
catalogue products. Use `get_skill` with `go-pro-reseau` or `go-pro-mlm` to
retrieve the full skill instructions and all included reference files.

## Supabase

Install dependencies and copy `.env.example` to `.env.local`. Set
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the
selected Supabase project's API settings. Apply the SQL migrations in order.

The client is created by `getSupabaseClient()` in
`src/lib/supabase/client.ts`; it throws a clear error if either variable is
missing. Only the public anon/publishable key belongs in these variables.
Never expose a Supabase service-role key to browser code.

## Production checkout and delivery

Checkout accepts only SasPay live keys beginning with `sk_live_`. Configure
`SASPAY_API_KEY`, `SASPAY_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, and
`SKILLFLOW_ADMIN_EMAIL` as server-only Vercel values. Do not expose these values
with a `NEXT_PUBLIC_` prefix or put them in source control or chat.

The live pilot is 280 XOF, restricted to the verified `SKILLFLOW_ADMIN_EMAIL`
account. This approximates USD 0.50; confirm the exchange conversion and SasPay
minimum with the provider. `BOOST` is disabled during the pilot. After the pilot,
set `INITIAL_LIVE_TRIAL_PRICE_XOF` to `null` in `src/lib/pricing.ts` to restore
the 39 EUR price and the 10 EUR `BOOST` discount.

`ADMIN` grants administrator privileges only to the verified allowlisted account
after successful payment. `BOOST` leaves a purchaser with the normal customer role.
Paid customers can download the private v1.0.0 archive from their account using a
short-lived signed URL.

Follow [docs/deployment.md](./docs/deployment.md) to apply migrations in order,
upload the archive to private Supabase Storage, configure the production webhook,
and validate the account and purchase flow. A redirect alone never confirms payment;
the signed webhook and server-side transaction verification do.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
