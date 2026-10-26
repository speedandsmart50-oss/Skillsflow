import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { hasDisallowedMessageContent, isSameOriginRequest, isValidCommunitySearchQuery, isValidUuid } from "../src/lib/community/policy";

test("community search queries have bounded length and reject control characters", () => {
  assert.equal(isValidCommunitySearchQuery("suivi client"), true);
  assert.equal(isValidCommunitySearchQuery("a"), false);
  assert.equal(isValidCommunitySearchQuery("x".repeat(101)), false);
  assert.equal(isValidCommunitySearchQuery("test\nother"), false);
});

test("community write requests must be same-origin and provide the origin", () => {
  assert.equal(isSameOriginRequest(new Request("https://skillflow.example/api", { headers: { origin: "https://skillflow.example", host: "skillflow.example" } })), true);
  assert.equal(isSameOriginRequest(new Request("https://skillflow.example/api", { headers: { origin: "https://attacker.example", host: "skillflow.example" } })), false);
  assert.equal(isSameOriginRequest(new Request("https://skillflow.example/api", { headers: { host: "skillflow.example" } })), false);
});

test("community identifiers and ethical message guard reject invalid inputs", () => {
  assert.equal(isValidUuid("0a1b2c3d-4e5f-4678-9abc-def012345678"), true);
  assert.equal(isValidUuid("not-a-uuid"), false);
  assert.equal(hasDisallowedMessageContent("Des gains garantis sont promis"), true);
  assert.equal(hasDisallowedMessageContent("Je vous garantis des gains."), true);
  assert.equal(hasDisallowedMessageContent("Dernière chance pour devenir riche"), true);
  assert.equal(hasDisallowedMessageContent("Je peux vous expliquer les étapes sans pression."), false);
});

test("community migration enables RLS and limits channel and message access", async () => {
  const migration = await readFile(new URL("../supabase/migrations/030_community_phase_one.sql", import.meta.url), "utf8");
  for (const table of ["community_memberships", "community_staff", "community_members", "channels", "messages", "reactions", "reports", "channel_reads"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(migration, /community_can_access_channel\(channel_id\)/i);
  assert.match(migration, /author_id = auth\.uid\(\)/i);
  assert.match(migration, /accept_community_rules/i);
  const searchMigration = await readFile(new URL("../supabase/migrations/031_community_message_search.sql", import.meta.url), "utf8");
  assert.match(searchMigration, /generated always as \(to_tsvector/i);
  assert.match(searchMigration, /using gin \(search_vector\)/i);
  const notificationsMigration = await readFile(new URL("../supabase/migrations/032_community_reply_notifications.sql", import.meta.url), "utf8");
  assert.match(notificationsMigration, /alter table public\.community_notifications enable row level security/i);
  assert.match(notificationsMigration, /user_id = auth\.uid\(\)/i);
  assert.match(notificationsMigration, /after insert on public\.messages/i);
  const moderationMigration = await readFile(new URL("../supabase/migrations/033_community_report_moderation.sql", import.meta.url), "utf8");
  assert.match(moderationMigration, /grant update \(status\) on public\.reports to authenticated/i);
  assert.match(moderationMigration, /create policy reports_staff_update[\s\S]*public\.community_is_staff\(\)/i);
  const messagesRoute = await readFile(new URL("../src/app/api/community/channels/[channelId]/messages/route.ts", import.meta.url), "utf8");
  assert.equal((messagesRoute.match(/reactions!reactions_message_id_channel_id_fkey\(/g) ?? []).length, 2);
  const weeklyGoalMigration = await readFile(new URL("../supabase/migrations/034_community_weekly_goals.sql", import.meta.url), "utf8");
  assert.match(weeklyGoalMigration, /alter table public\.community_weekly_goal_checks enable row level security/i);
  assert.match(weeklyGoalMigration, /user_id = auth\.uid\(\)/i);
  assert.match(weeklyGoalMigration, /community_weekly_goal_roster/i);
  assert.match(weeklyGoalMigration, /auth\.uid\(\) is null or not public\.community_is_staff\(\)/i);
  assert.match(weeklyGoalMigration, /week_start = date_trunc\('week', current_date\)::date/i);
  const weeklyGoalTaskReset = await readFile(new URL("../supabase/migrations/035_community_weekly_goal_task_reset.sql", import.meta.url), "utf8");
  assert.match(weeklyGoalTaskReset, /existing_task_label is distinct from trim\(item\)/i);
  assert.match(weeklyGoalTaskReset, /delete from public\.community_weekly_goal_checks where task_id = existing_task_id/i);
  const weeklyGoalRoute = await readFile(new URL("../src/app/api/community/weekly-goal/route.ts", import.meta.url), "utf8");
  assert.equal((weeklyGoalRoute.match(/isSameOriginRequest\(request\)/g) ?? []).length, 2);
  assert.match(weeklyGoalRoute, /export async function PUT\(request: Request\)/);
  assert.match(weeklyGoalRoute, /export async function PATCH\(request: Request\)/);
});
