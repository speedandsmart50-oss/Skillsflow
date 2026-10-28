import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("subscription limits and paid areas are enforced in the server layer", async () => {
  const migration = await readFile(new URL("../supabase/migrations/044_subscription_limits_and_paid_communities.sql", import.meta.url), "utf8");
  const prospection = await readFile(new URL("../src/app/member/prospection/page.tsx", import.meta.url), "utf8");
  const communityRoute = await readFile(new URL("../src/app/api/community/my/route.ts", import.meta.url), "utf8");
  const navigation = await readFile(new URL("../src/components/account-dashboard.tsx", import.meta.url), "utf8");

  assert.match(migration, /subscription_skill_limit/);
  assert.match(migration, /skillflow-plus.*then 1/);
  assert.match(migration, /skillflow-pro.*then 2/);
  assert.match(migration, /skillflow-max.*then 3/);
  assert.match(migration, /member_subscription_skills/);
  assert.match(migration, /has_active_member_subscription/);
  assert.match(prospection, /member_subscriptions/);
  assert.match(communityRoute, /hasActiveSubscription/);
  assert.match(navigation, /href="\/member\/prospection"/);
});

test("Max uses a contact form before any payment flow", async () => {
  const pricing = await readFile(new URL("../src/components/pricing-grid.tsx", import.meta.url), "utf8");
  const form = await readFile(new URL("../src/components/max-contact-form.tsx", import.meta.url), "utf8");

  assert.match(pricing, /href="\/contact\/max"/);
  assert.match(form, /support-tickets/);
  assert.match(form, /consent/);
  assert.match(form, /avant toute proposition de paiement/);
});

