# SkillFlow architecture

SkillFlow is a product marketplace for downloadable AI skill packs. The MVP is intentionally compact and centered on a few critical flows:

- product catalog and product detail pages
- customer authentication and account access
- secure download authorization and version history
- admin publication and monitoring workflows
- SasPay live payments with server-side transaction verification and idempotent webhook processing

The application uses Next.js App Router, TypeScript strict mode, and Tailwind CSS. Supabase stores profiles, products, paid orders, and download records. Product archives remain in a private Storage bucket and are delivered through short-lived signed URLs after a server-side purchase check.
