import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/051_messaging_send_rules.sql",
  import.meta.url,
);
const rollbackUrl = new URL(
  "../supabase/rollback/051_messaging_send_rules.down.sql",
  import.meta.url,
);

test("send rules migration adds restricted template and reservation tables", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /create table public\.msg_approved_templates\b/i);
  assert.match(migration, /approval_status text not null default 'pending'/i);
  assert.match(migration, /create table public\.msg_send_reservations\b/i);
  assert.match(migration, /template_language text check/i);
  assert.match(migration, /foreign key \(contact_id, user_id\)[\s\S]*references public\.msg_contacts\(id, user_id\)/i);
  assert.match(migration, /foreign key \(message_id, user_id, channel\)[\s\S]*references public\.msg_messages\(id, user_id, channel\)/i);
  assert.match(migration, /alter table public\.msg_approved_templates enable row level security/i);
  assert.match(migration, /alter table public\.msg_send_reservations enable row level security/i);
  assert.match(migration, /from public, anon, authenticated/i);

  assert.match(migration, /create function public\.evaluate_messaging_send/i);
  assert.match(migration, /p_live_send_enabled boolean/i);
  assert.match(migration, /p_existing_message_id uuid/i);
  assert.match(migration, /p_existing_message_id is null or r\.message_id <> p_existing_message_id/i);
  assert.match(migration, /m\.status = 'draft'/i);
  assert.match(migration, /live_sending_disabled/i);
  assert.match(migration, /set search_path = pg_catalog, public, pg_temp/i);
  assert.match(migration, /pg_advisory_xact_lock/i);
  assert.match(migration, /v_contact\.consent_given/i);
  assert.match(migration, /v_contact\.consent_at/i);
  assert.match(migration, /interval '24 hours'/i);
  assert.match(migration, /approval_status = 'approved'/i);
  assert.match(migration, /last_verified_at > v_now - interval '24 hours'/i);
  assert.match(migration, /char_length\(btrim\(p_content\)\) not between 1 and 4096/i);
  assert.match(migration, /'template:' \|\| btrim\(p_template_name\)/i);
  assert.match(migration, /rate_limit_exceeded/i);
  assert.match(migration, /duplicate_message/i);
  assert.match(migration, /send\.denied/i);
  assert.match(migration, /case when p_dry_run then 'draft' else 'approved' end/i);
  assert.match(migration, /to service_role/i);
  assert.doesNotMatch(migration, /\b(drop table|truncate|delete from)\b/i);
  assert.doesNotMatch(migration, /\balter table public\.(?!msg_)/i);
});

test("send rules rollback removes only its helper, tables, and supporting index", async () => {
  const rollback = await readFile(rollbackUrl, "utf8");
  const droppedObjects = Array.from(
    rollback.matchAll(/drop (?:function|table|index) if exists public\.([a-z_]+)/gi),
    (match) => match[1].toLowerCase(),
  );

  assert.deepEqual(droppedObjects, [
    "evaluate_messaging_send",
    "msg_send_reservations",
    "msg_approved_templates",
    "msg_messages_id_user_channel_uq",
  ]);
  assert.match(rollback, /evaluate_messaging_send\(uuid, uuid, uuid, text, text, text, text, text, uuid, boolean, boolean, boolean, integer, integer\)/i);
  assert.doesNotMatch(rollback, /\bcascade\b/i);
});
