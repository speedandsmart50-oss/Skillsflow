# SkillFlow — incremental skills, member agents, and MCP roadmap

## Audit snapshot (2026-10-24)

- Frontend: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS.
- APIs: Next.js Route Handlers for account, admin, checkout, SasPay webhooks, products, and MCP.
- Database/auth: Supabase Postgres, Auth, and RLS.
- Payments: existing SasPay flow; `orders` and `entitlements` remain the payment/access source of truth.
- Storage: private `product-packs` and `agent-conversations` buckets. Conversation screenshots can be uploaded, but OCR, anonymization and profile generation are not implemented.
- AI/OCR: no provider or key configured in the repository. Generation must remain unavailable until a provider is selected and configured.
- Current catalog: `products` and `skill_versions`; current MCP endpoint is `/api/mcp` and exposes `list_skills` and `get_skill`.
- Member space: `/account`, guarded by Supabase authentication; sidebar sections include catalog and personal conversation examples.
- No `/member` route family or 30-item database library existed at audit time.

## Incremental plan

1. Add `skill_categories`, `skills`, explicit member grants, and personal agent data in migration 011.
2. Seed 15 requested categories and 30 initial skills; link prospecting clone to the existing product only when a matching product exists.
3. Keep payment records in existing tables; access checks consult `entitlements` and member grants.
4. Add authenticated API to list available/catalog skills, inspect details, and create/update a skill configuration.
5. Add member skill library pages under `/member` while reusing Supabase session guards and the current dark cyan design.
6. Extend the existing MCP endpoint with authenticated discovery, configuration, feedback, and agent-session tools.
7. Keep file ingestion, OCR and anonymization staged; no external AI/OCR provider is installed or assumed.
8. Do not expose member data to MCP without owner context and skill entitlement checks.
9. Add MCP usage auditing, rate limits and protected resources before production enablement.
10. Verify migration syntax/behavior, API owner isolation, tests, lint, production build, and a live MCP handshake.

## Proposed migration

`supabase/migrations/011_skills_library_and_member_agents.sql` is additive. It retains `products`, `orders`, `entitlements`, SasPay, and existing routes. It adds skill/categories, access grants, configuration, private files, extracted messages, communication profiles and versions, sessions/messages, outputs, feedback, MCP connection metadata, and MCP usage tables, with RLS. Seed definitions live in the next migration chunk.

## MCP tools to deliver incrementally

`list_available_skills`, `get_skill_details`, `start_skill_configuration`, `update_skill_configuration`, `upload_skill_file`, `extract_conversation_data`, `anonymize_extracted_data`, `analyze_communication_style`, `generate_communication_profile`, `chat_with_skill_agent`, `generate_skill_output`, `rate_agent_response`, `update_profile_from_feedback`, `list_member_files`, `list_generated_outputs`.

Existing `list_skills` and `get_skill` remain compatible. Private tools must derive user identity only from verified bearer credentials and check skill access. No user_id argument is trusted from the model. The repository has no AI/OCR provider, so these tools must clearly report unavailable provider rather than fabricate AI processing until provider selection/configuration is approved.
