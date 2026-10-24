# SkillFlow architecture

SkillFlow is a product marketplace for downloadable AI skill packs. The MVP is intentionally compact and centered on a few critical flows:

- product catalog and product detail pages
- customer authentication and account access
- secure download authorization and version history
- admin publication and monitoring workflows
- isolated payment handling ready for SasPay integration

The application uses Next.js App Router, TypeScript strict mode, and Tailwind CSS. Data and access layers are intentionally separated from the UI so versioning, payment verification, and download authorization remain easy to replace with real Supabase policies and server-side checks later.
