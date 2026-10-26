import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { hasDisallowedMessageContent, isSameOriginRequest, isValidUuid } from "../src/lib/community/policy";

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
});
