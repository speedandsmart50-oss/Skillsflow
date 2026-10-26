import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("community suggestions are private, authenticated, and stored in admin support", () => {
  const route = read("../src/app/api/community/suggestions/route.ts");
  const form = read("../src/components/community/community-suggestion-form.tsx");
  const admin = read("../src/components/admin-dashboard.tsx");

  assert.match(route, /isSameOriginRequest\(request\)/);
  assert.match(route, /getCommunitySession\(\)/);
  assert.match(route, /community_rules_version !== activeRules\.version/);
  assert.match(route, /category: "suggestion"/);
  assert.match(route, /message\.trim\(\)\.length > 5000/);
  assert.match(form, /id="suggestion"/);
  assert.match(form, /Seule l’équipe SkillFlow pourra lire votre suggestion/);
  assert.match(admin, /Suggestion de la communauté/);
});

test("suggestions are reachable from the community navigation and allowed by the ticket schema", () => {
  const shell = read("../src/components/community/community-shell.tsx");
  const migration = read("../supabase/migrations/037_community_suggestions.sql");

  assert.match(shell, /href="\/community#suggestion"/);
  assert.match(shell, /Faire une suggestion/);
  assert.match(migration, /drop constraint if exists support_tickets_category_check/);
  assert.match(migration, /'question', 'refund', 'other', 'suggestion'/);
});
