import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeUrl = new URL(
  "../src/app/api/member/prospection/reminders/route.ts",
  import.meta.url,
);
const pageUrl = new URL(
  "../src/app/member/prospection/page.tsx",
  import.meta.url,
);
const migrationUrl = new URL(
  "../supabase/migrations/056_prospection_reminders.sql",
  import.meta.url,
);
const rollbackUrl = new URL(
  "../supabase/rollback/056_prospection_reminders.down.sql",
  import.meta.url,
);
const componentUrl = new URL(
  "../src/components/prospection-reminders.tsx",
  import.meta.url,
);

test("prospection reminder API requires a paid user and scopes all rows to that user", async () => {
  const route = await readFile(routeUrl, "utf8");

  assert.match(route, /getAuthenticatedUser\(request\)/);
  assert.match(route, /isConfiguredAdmin\(user\)/);
  assert.match(route, /has_active_member_subscription/);
  assert.match(route, /\.eq\("user_id", access\.userId\)/);
  assert.match(route, /prospect introuvable|Contact introuvable/i);
  assert.match(route, /\.eq\("status", "draft"\)/);
  assert.match(route, /Date\.now\(\) \+ 365 \* 24 \* 60 \* 60 \* 1000/);
});

test("prospection reminders are isolated from other members and linked to owned prospects", async () => {
  const [migration, rollback] = await Promise.all([
    readFile(migrationUrl, "utf8"),
    readFile(rollbackUrl, "utf8"),
  ]);

  assert.match(migration, /foreign key \(prospect_id, user_id\)[\s\S]*references public\.prospection_prospects\(id, user_id\) on delete cascade/i);
  assert.match(migration, /alter table public\.prospection_reminders enable row level security/i);
  assert.match(migration, /auth\.uid\(\) = user_id/i);
  assert.match(migration, /has_active_member_subscription\(auth\.uid\(\)\)/i);
  assert.match(rollback, /drop table if exists public\.prospection_reminders/i);
  assert.match(rollback, /drop constraint if exists prospection_prospects_id_user_id_key/i);
});

test("member dashboard is included only for paid members or the configured administrator", async () => {
  const [page, component] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(componentUrl, "utf8"),
  ]);

  assert.match(page, /hasAccess \? \([\s\S]*<ProspectionPipeline \/>[\s\S]*<ProspectionReminders \/>/);
  assert.match(component, /Indicateurs et rappels/);
  assert.match(component, /aucun message n’est envoyé/i);
  assert.match(component, /createReminder/);
  assert.match(component, /updateReminder/);
});
