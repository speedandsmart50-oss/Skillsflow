# Correctifs appliqués — suite à l'audit complet — 31 octobre 2026

## Contexte

Audit complet du projet SkillFlow réalisé le 31 octobre 2026, suivi des correctifs
demandés (« fixe tout »). Les failles importantes déjà signalées lors de l'audit du
25/10 (quota MCP contournable, sessions de paiement répétables) étaient déjà en cours
de correction dans le code ; ce document porte sur les correctifs ajoutés depuis cet
audit.

## Correctifs appliqués

### 1. Rate limiting des flux d'authentification (constat 🟠 — corrigé)

- Migration `supabase/migrations/048_auth_rate_limit.sql` : nouvelle scope `auth_ip`
  (10 tentatives / minute / IP) sur `api_rate_limit_buckets` et `consume_api_rate_limit`.
- `src/lib/security/api-rate_limit.ts` : scope `auth_ip` ajoutée, helper partagé
  `getRateLimitIpSubjectKey()` (IP via HMAC-SHA256 + clé service-role).
- `src/app/auth/callback/route.ts` : rate limit avant échange OTP / code
  (fail-closed, redirection `/login?error=auth_rate_limited` si dépassé).
- `src/app/token/route.ts` : rate limit avant grant OAuth (HTTP 429 si dépassé).
- `src/app/api/mcp/route.ts` : réutilisation du helper partagé (suppression de la
  duplication).

### 2. Hygiène `.gitignore`

- Suppression des entrées dupliquées (`.env*`, `.vercel`).

## Validations après correctifs

- `npm run lint` : ✅ 0 erreur
- `npm run test` : ✅ **73/73 passés** (dont 3 nouveaux tests sur la scope `auth_ip`)
- `npx tsc --noEmit` : ✅ Aucune erreur
- `npm run build` : ✅ Réussi (Next.js 16.4.3)

## Reste à traiter (hors code)

- Appliquer les migrations Supabase `014` et `015` en production puis redéployer.
- Configurer côté Supabase/Vercel : rate limits Auth, CAPTCHA, cookies de session,
  état RLS réel, migrations appliquées.
- TODOs produit non résolus (règle de changement de skill, checkout « Max » / offre Jarvis).

## Fichiers modifiés

```
 .gitignore                        |   4 ----
 src/app/api/mcp/route.ts          |  10 ++--
 src/app/auth/callback/route.ts    |  15 +++++++++++++++
 src/app/token/route.ts            |  14 ++++++++++++++
 src/lib/security/api-rate-limit.ts | 15 ++++++++++++++-
 tests/api-rate-limit.test.ts     |  31 ++++++++++++++++++++++++++++++-
 6 files changed, 76 insertions(+), 13 deletions(-)
+ supabase/migrations/048_auth_rate_limit.sql (nouveau)
```
