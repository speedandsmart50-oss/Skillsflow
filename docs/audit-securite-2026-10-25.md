# Audit sécurité SkillFlow — 25 octobre 2026

## Périmètre et méthode

Audit statique du dépôt, migrations Supabase versionnées, configuration Next.js, dépendances de production, règles de stockage et en-têtes HTTP de la version de production `https://skillflow-sigma.vercel.app`. Le skill appliqué est [audit-securite-saas](../.agents/skills/audit-securite-saas/SKILL.md); son scanner est [scan.sh](../.agents/skills/audit-securite-saas/scripts/scan.sh).

Cet audit n’a effectué aucune modification de sécurité ni aucune écriture sur Supabase ou Vercel. Les réglages effectifs du projet Supabase (migrations réellement appliquées, limites d’authentification, CAPTCHA) n’ont pas pu être lus de manière fiable dans le tableau de bord et restent donc **non vérifiés**. Les migrations citées sont des preuves du dépôt, pas la preuve qu’elles sont appliquées en production.

## Suivi après correctifs — 25 octobre 2026

Les constats importants de l’audit initial ont reçu une correction dans le dépôt local :

- Le compteur d’usage MCP a été remplacé par un seau de jetons atomique en base, non modifiable par un compte membre; les appels sont aussi limités par adresse IP via le header Vercel de confiance. L’historique `mcp_tool_usage` est désormais en lecture seule côté membre.
- Le checkout réutilise une session en attente, limite les nouvelles tentatives par compte et verrouille en base la création de commandes simultanées pour le même skill.
- La CSP et les en-têtes navigateur sont configurés; un test HTTP local après build confirme leur présence.
- Les captures sont vérifiées côté serveur avant d’être liées à une conversation. L’insertion directe d’une conversation par un membre est retirée; les lignes sont créées par la route authentifiée.
- Les fichiers importés via MCP sont contrôlés contre leur signature réelle, pas seulement leur type déclaré.

**La production n’est pas encore corrigée.** Les migrations [014](../supabase/migrations/014_atomic_api_limits.sql) et [015](../supabase/migrations/015_verified_conversation_screenshots.sql) doivent être appliquées au projet Supabase, puis le code doit être déployé. Aucun push ni changement Supabase distant n’a été fait pendant ce suivi. Jusqu’à ces deux étapes, les protections du site actuellement en ligne ne changent pas.

Vérification locale après correctifs : `npm run test` (**35 tests passés**), `npm run build` (**réussi**) et contrôle HTTP local des en-têtes de sécurité (**présents**). Le SQL des nouvelles migrations n’a pas pu être exécuté localement, car aucun serveur PostgreSQL/Docker n’est installé dans cet environnement.

## Résumé de l’audit initial (avant correctifs)

**Verdict : à corriger dans la semaine, sans faille bloquante confirmée.** Deux limites de débit sont contournables ou absentes sur des opérations qui consomment des ressources. Les en-têtes navigateur sont incomplets. L’état réel de RLS et de l’authentification Supabase en production reste à confirmer. Aucun secret reconnu n’a été trouvé dans les fichiers suivis ou l’exemple historique examiné. `npm audit --omit=dev` signale zéro vulnérabilité connue dans les dépendances de production au moment de l’audit.

| Niveau | Nombre |
|---|---:|
| Bloquant confirmé | 0 |
| Important | 2 |
| À faire | 2 |
| Non vérifié | 1 |

| Priorité | Constat | État |
|---|---|---|
| Important | Le quota MCP peut être réinitialisé par le membre lui-même | Confirmé dans la migration et les requêtes MCP |
| Important | Une session SasPay peut être créée à répétition avec des identifiants de tentative différents | Confirmé dans la route checkout; aucune limite de fréquence visible |
| À faire | En-têtes de protection navigateur incomplets en production | Confirmé par contrôle HTTP et configuration |
| Non vérifié | État RLS réel, limites Supabase Auth et CAPTCHA en production | Non vérifié dans le dashboard |
| À faire | Contrôle des captures d’écran côté navigateur; validation de contenu serveur non démontrée | Confirmé côté code |
| Info | Données conversationnelles et captures; chiffrement au repos géré par Supabase, aucun chiffrement applicatif par champ observé | Confirmé côté code / documentation fournisseur |
| Info | Aucun secret correspondant aux formats recherchés dans le dépôt ou le commit historique examiné | Recherche effectuée; limitée aux motifs connus |

## Constats détaillés de l’audit initial

### 1. Quota MCP contournable — important

**Preuve :** [migration 011](../supabase/migrations/011_skills_library_and_member_agents.sql#L94) crée `mcp_tool_usage`; aux lignes 101–105, elle active RLS mais crée une policy `FOR ALL` pour les lignes du membre et lui accorde les opérations `SELECT, INSERT, UPDATE, DELETE`. [L’API MCP](../src/app/api/mcp/route.ts#L287) compte ces lignes pour refuser après 60 appels/minute et journalise les appels aux lignes 296 et 302.

Un membre connecté peut supprimer directement ses propres lignes `mcp_tool_usage` avec son jeton Supabase, sans passer par l’API MCP, puis recommencer à utiliser ses 60 appels. La vérification et l’écriture séparées laissent aussi passer plusieurs appels concurrents au-delà du quota. Le quota actuel ne constitue donc pas une limite fiable. Déplacer ce compteur vers un mécanisme atomique inaccessible au rôle `authenticated` (RPC contrôlée ou stockage serveur/Redis) et incrémenter avant l’exécution de l’outil.

### 2. Création de paiement répétable — important

**Preuve :** [route checkout](../src/app/api/payments/checkout/route.ts#L17) exige le commerce actif, une session authentifiée et une adresse confirmée ([ligne 52](../src/app/api/payments/checkout/route.ts#L52)). Elle accepte un `requestId` fourni par le client ([ligne 63](../src/app/api/payments/checkout/route.ts#L63)) et utilise cette valeur pour l’idempotence ([ligne 135](../src/app/api/payments/checkout/route.ts#L135)); un nouvel UUID passe donc comme une nouvelle tentative et la route crée une commande puis appelle SasPay ([lignes 188 et 203](../src/app/api/payments/checkout/route.ts#L188)). Aucune limite de fréquence ou limite de sessions pending par compte n’est visible dans cette route.

Un compte avec email confirmé peut automatiser des demandes de sessions abandonnées, créant des commandes en attente et sollicitant SasPay sans plafond applicatif visible. L’effet financier précis dépend du contrat et des limites SasPay. Ajouter un quota serveur par compte et une règle empêchant plusieurs sessions en attente pour le même produit; conserver l’idempotence pour les retries légitimes.

### 3. En-têtes HTTP — à faire

La production répond en HTTPS et renvoie `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`. La réponse HEAD contrôlée ne présentait pas de CSP, `X-Content-Type-Options`, `Referrer-Policy` ni protection anti-iframe (`frame-ancestors` ou `X-Frame-Options`). La configuration Next.js ne définit pas ces en-têtes. Ajouter une CSP adaptée aux ressources réellement utilisées, `X-Content-Type-Options: nosniff`, une politique de référent et `frame-ancestors` est recommandé, puis vérifier les parcours OAuth, paiements et images avant déploiement.

### 4. Limitation de débit des autres routes — à surveiller

Les routes publiques de lecture catalogue sont simples et mises en cache. Une limite applicative générale n’a pas été repérée sur les routes coûteuses hors quota MCP et checkout, décrits ci-dessus. Une protection au niveau Supabase Auth, Vercel ou du fournisseur peut exister, mais ses réglages n’ont pas été vérifiés. Vérifier les quotas effectifs avant d’exposer plus largement le service.

Supabase documente des limites Auth configurables et un CAPTCHA activable; la documentation ne prouve pas que ces options soient activées sur ce projet : [limites Auth](https://supabase.com/docs/guides/auth/rate-limits), [CAPTCHA Auth](https://supabase.com/docs/guides/auth/auth-captcha).

### 5. Autorisations et données — état du dépôt positif, état live à confirmer

Les routes membre examinées authentifient l’utilisateur; les routes d’administration passent par `requireAdminApiUser`; MCP authentifie une clé et valide les entrées avec Zod; le webhook de paiement vérifie sa signature. Les migrations versionnées activent RLS et limitent plusieurs tables aux enregistrements appartenant à `auth.uid()`. Les conversations sont limitées à leur propriétaire et le bucket de captures est privé, avec règles de chemin utilisateur, types JPEG/PNG/WebP et limite de 7 Mio par objet. Les politiques du catalogue limitent la lecture publique aux skills actifs.

Je n’ai pas pu obtenir une exécution vérifiable de la requête de lecture RLS dans le SQL Editor. Il faut confirmer que les migrations jusqu’à `011` sont effectivement appliquées sur le projet Supabase de production et tester avec un compte membre qu’un autre utilisateur ne peut ni lire ni modifier ses données.

### 6. Upload de captures — à faire

Le formulaire restreint côté navigateur les images à six fichiers JPEG/PNG/WebP de 7 Mio maximum et le bucket applique aussi une limite de taille et de types MIME. Le code audité ne démontre pas de vérification serveur de la signature réelle du contenu (magic bytes) pour ces images. Les types MIME envoyés par un client ne suffisent pas à prouver le format; envisager une validation serveur avant stockage ou traitement.

### 7. Secrets et variables

Le scan de l’arbre courant n’a pas trouvé de clé correspondant aux motifs de clés Supabase/SasPay recherchés. Le commit historique `6bc77c9` contenait des variables dans `.env.example`, dont `SUPABASE_SERVICE_ROLE_KEY=server-only-service-role-key`; les valeurs contrôlées sont des placeholders, et le diff n’a pas révélé de token SasPay correspondant au motif recherché. Ce contrôle ne garantit pas l’absence de secrets d’un format inconnu ni dans les objets Git non accessibles par les recherches utilisées.

Le client navigateur utilise la clé publique anon; le service-role est lu dans un module marqué `server-only`. Les fichiers `.env*` sont ignorés par Git sauf l’exemple. Supabase déclare le chiffrement des données stockées au repos dans sa [FAQ de sécurité et résidence des données](https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq). Je n’ai pas observé de chiffrement applicatif par champ pour le contenu des conversations; les données restent accessibles au service et aux personnes/administrateurs autorisés selon les politiques effectives.

## Vérifications effectuées

- `npm audit --omit=dev` : **0 vulnérabilité** signalée.
- Recherche de secrets connus dans l’arbre suivi et contrôle du commit `6bc77c9` : **aucun secret reconnu identifié**; l’exemple historique utilise des placeholders.
- Recherche ciblée des routes : contrôles d’identité pour les routes compte/membre, garde d’administration, vérification du webhook et authentification MCP constatées dans le code.
- Migrations locales `001`, `005`, `010` et `011` : règles RLS et règles de stockage présentes dans le dépôt.
- En-têtes production : HTTPS et HSTS observés; les autres en-têtes listés plus haut n’étaient pas présents dans la réponse contrôlée.
- CAPTCHA, quotas effectifs Supabase/Vercel/SasPay et migrations réellement déployées : **non vérifiés**.

## Les 20 contrôles

| N° | Contrôle | Statut | Résultat |
|---:|---|---|---|
| 1 | Clés API dans le code | OK, motifs connus | Aucun secret reconnu trouvé dans les fichiers scannés. |
| 2 | Secrets dans l’historique Git | OK, contrôle ciblé | `.env.example` historique contient des placeholders; pas de clé reconnue. |
| 3 | Clé Supabase côté navigateur | OK, code | Client avec clé anon; service-role isolée côté serveur. |
| 4 | RLS | Non vérifié en production | Policies présentes dans les migrations; déploiement réel à confirmer. |
| 5 | Chiffrement des données sensibles | Partiel | Chiffrement au repos fournisseur; pas de chiffrement applicatif par champ observé. |
| 6 | Authentification côté serveur | OK, routes vérifiées | Auth sur routes compte/membre; garde dédiée pour administration. |
| 7 | Accès par enregistrement | Partiel | Filtrage propriétaire et policies locales présents; test croisé live non effectué. |
| 8 | Champs sensibles non modifiables | OK, contrôle ciblé | Pas de mise à jour directe du corps complet détectée; opérations sensibles réservées aux routes autorisées. |
| 9 | Cookies/session | Non vérifié en production | Client SSR utilisé; attributs réellement émis et stockage navigateur non testés. |
| 10 | Hachage des mots de passe | OK, délégué | Authentification gérée par Supabase; aucun stockage maison repéré. |
| 11 | Limite des tentatives Auth | Non vérifié en production | Réglages Supabase Auth non lisibles pendant cet audit. |
| 12 | CAPTCHA / anti-bot | Non vérifié en production | Réglages du fournisseur non confirmés; aucun CAPTCHA applicatif trouvé. |
| 13 | Requêtes SQL paramétrées | OK, code examiné | Client Supabase et fonctions paramétrées; SQL dynamique utilisant une liste fixe d’identifiants. |
| 14 | Validation des entrées | Partiel | Zod sur MCP et validations serveur spot-checkées; toutes les routes/champs ne sont pas exhaustivement revus. |
| 15 | Échappement XSS | OK, sources applicatives | Aucun rendu HTML brut suspect dans `src`; signaux de scanner dans des références archivées uniquement. |
| 16 | Uploads restreints | À faire | MIME/taille et stockage privé contrôlés; magic bytes serveur non démontrés pour les captures. |
| 17 | Réponses API minimales | OK, contrôle ciblé | Sélections explicites observées; pas de `select('*')` applicatif détecté. |
| 18 | Headers navigateur | À faire | HSTS présent; CSP, nosniff, Referrer-Policy et anti-iframe absents de la réponse vérifiée. |
| 19 | HTTPS | OK, contrôle précédent | La production redirige HTTP vers HTTPS; HSTS présent. |
| 20 | Dépendances | OK | `npm audit --omit=dev` : zéro vulnérabilité. |

## Étapes restantes pour la production

1. Appliquer les migrations `014` et `015` à Supabase, puis déployer le code associé.
2. Après déploiement, tester MCP avec une clé membre, dépasser volontairement le quota et confirmer la réponse HTTP 429 avec `Retry-After`.
3. Tester avec deux comptes que les captures et conversations restent isolées; vérifier qu’un membre ne peut plus insérer directement une conversation ou supprimer les lignes du compteur MCP.
4. Recontrôler les en-têtes HTTP en production et vérifier la connexion Google, SasPay et les images avec la CSP.
5. Vérifier dans Supabase les migrations appliquées, les limites Auth, le CAPTCHA et les attributs des cookies de session.

\n