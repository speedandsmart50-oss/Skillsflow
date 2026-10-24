# SkillFlow architecture

SkillFlow is a product marketplace for downloadable AI skill packs. The MVP is intentionally compact and centered on a few critical flows:

- product catalog and product detail pages
- customer authentication and account access
- secure download authorization and version history
- admin publication and monitoring workflows
- SasPay live payments with server-side transaction verification and idempotent webhook processing

The application uses Next.js App Router, TypeScript strict mode, and Tailwind CSS. Supabase Auth identifies users and `profiles` stores each user's application role. `products` remains the catalogue model for existing SkillFlow packs, with `skill_versions` storing the Claude and ChatGPT files. Confirmed payments create `entitlements`; the signed webhook does this atomically with the order update. Row-level security limits customer data to its owner, and the server verifies administrator access.

MCP key hashes, waitlist entries, support tickets, and administrator audit events are stored separately. Raw MCP keys are never persisted. Product files remain in private Storage and are delivered through short-lived signed URLs after a server-side entitlement check.
