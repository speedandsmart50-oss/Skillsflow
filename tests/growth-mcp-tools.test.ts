import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { isConfiguredMessagingAdmin } from "../src/lib/messaging/mcp-tools/access-policy";

const registerUrl = new URL(
  "../src/lib/messaging/mcp-tools/growth-register.ts",
  import.meta.url,
);
const routeUrl = new URL("../src/app/api/mcp/route.ts", import.meta.url);
const migrationUrl = new URL(
  "../supabase/migrations/055_growth_metrics_and_reminders.sql",
  import.meta.url,
);
const rollbackUrl = new URL(
  "../supabase/rollback/055_growth_metrics_and_reminders.down.sql",
  import.meta.url,
);

test("growth MCP registration uses an independent flag and admin guard", async () => {
  const [register, route] = await Promise.all([
    readFile(registerUrl, "utf8"),
    readFile(routeUrl, "utf8"),
  ]);

  assert.match(route, /if \(isGrowthEnabled\(\)\)\s*\{\s*registerGrowthTools\(server, caller\);/);
  assert.match(register, /if \(!caller \|\| !isGrowthEnabled\(\)\) return server/);
  assert.match(register, /isConfiguredMessagingAdmin/);
  assert.match(register, /get_growth_metrics/);
  assert.match(register, /create_growth_reminder_draft/);
  assert.match(register, /list_growth_reminder_drafts/);
  assert.match(register, /complete_growth_reminder_draft/);
  assert.match(register, /cancel_growth_reminder_draft/);
  assert.doesNotMatch(register, /publish_|send_.*message|fetch\(/i);
  assert.doesNotMatch(register, /input_summary:\s*\{[^}]*details\s*[,}]/);
});

test("growth migration restricts access and excludes message content from metrics", async () => {
  const [migration, rollback] = await Promise.all([
    readFile(migrationUrl, "utf8"),
    readFile(rollbackUrl, "utf8"),
  ]);

  assert.match(migration, /alter table public\.growth_reminders enable row level security/i);
  assert.match(migration, /grant all on public\.growth_reminders to service_role/i);
  assert.match(migration, /unique \(user_id, idempotency_key\)/i);
  assert.match(migration, /growth administrator required/i);
  assert.match(migration, /p_since < now\(\) - interval '365 days'/i);
  assert.match(migration, /'inbound_messages'/i);
  assert.match(migration, /'sent_messages'/i);
  assert.doesNotMatch(migration, /'content'\s*,\s*m\.content/i);
  assert.match(rollback, /drop table if exists public\.growth_reminders/i);
});

test("growth tools reuse the exact configured administrator policy", () => {
  assert.equal(isConfiguredMessagingAdmin("admin", "owner@example.com", "OWNER@example.com"), true);
  assert.equal(isConfiguredMessagingAdmin("customer", "owner@example.com", "owner@example.com"), false);
  assert.equal(isConfiguredMessagingAdmin("admin", "other@example.com", "owner@example.com"), false);
});
