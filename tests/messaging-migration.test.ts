import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../supabase/migrations/049_inbound_messaging.sql", import.meta.url);
const rollbackUrl = new URL("../supabase/rollback/049_inbound_messaging.down.sql", import.meta.url);

test("inbound messaging migration creates isolated, owner-scoped tables only", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  for (const table of ["msg_contacts", "msg_messages", "msg_followups", "msg_audit_log"]) {
    assert.match(migration, new RegExp(`create table public\\.${table}\\b`, "i"));
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    assert.match(migration, new RegExp(`create policy msg_${table.slice(4)}_owner_access`, "i"));
  }

  assert.match(migration, /unique \(user_id, channel, external_contact_id\)/i);
  assert.match(migration, /unique \(user_id, channel, external_message_id\)/i);
  assert.match(migration, /unique \(user_id, channel, source_event_type, source_event_id\)/i);
  assert.match(migration, /content_type text not null default 'text'/i);
  assert.match(migration, /msg_messages_one_comment_reply_idx/i);
  assert.match(migration, /status in \('scheduled', 'processing', 'sent', 'cancelled'\)/i);
  assert.match(migration, /claim_token uuid/i);
  assert.match(migration, /foreign key \(contact_id, user_id, channel\)[\s\S]*references public\.msg_contacts\(id, user_id, channel\)/i);
  assert.match(migration, /foreign key \(contact_id, user_id\)[\s\S]*references public\.msg_contacts\(id, user_id\)/i);
  assert.match(migration, /from public, anon, authenticated/i);
  assert.match(migration, /to service_role/i);
  assert.doesNotMatch(migration, /\b(drop table|truncate|delete from)\b/i);
  assert.doesNotMatch(migration, /\balter table public\.(?!msg_)/i);
});

test("inbound messaging rollback removes only its own tables in dependency order", async () => {
  const rollback = await readFile(rollbackUrl, "utf8");
  const droppedTables = Array.from(
    rollback.matchAll(/drop table if exists public\.(msg_[a-z_]+);/gi),
    (match) => match[1].toLowerCase(),
  );

  assert.deepEqual(droppedTables, [
    "msg_audit_log",
    "msg_followups",
    "msg_messages",
    "msg_contacts",
  ]);
  assert.doesNotMatch(rollback, /\bcascade\b/i);
  assert.doesNotMatch(rollback, /public\.(?!msg_)[a-z_]+/i);
});
