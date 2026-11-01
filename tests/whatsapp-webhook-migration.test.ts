import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/050_whatsapp_webhook_queue.sql",
  import.meta.url,
);
const rollbackUrl = new URL(
  "../supabase/rollback/050_whatsapp_webhook_queue.down.sql",
  import.meta.url,
);

test("WhatsApp webhook migration adds only a service-role queue and guarded RPCs", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /create table public\.msg_webhook_events\b/i);
  assert.match(migration, /unique \(user_id, channel, event_hash\)/i);
  assert.match(migration, /event_hash ~ '\^\[0-9a-f\]\{64\}\$'/i);
  assert.match(migration, /status in \('pending', 'processing', 'processed', 'failed'\)/i);
  assert.match(migration, /claim_expires_at is not null/i);
  assert.match(migration, /alter table public\.msg_webhook_events enable row level security/i);
  assert.match(migration, /from public, anon, authenticated/i);
  assert.match(migration, /to service_role/i);
  assert.match(migration, /security definer[\s\S]*set search_path = public, pg_temp/i);
  assert.match(migration, /record_inbound_whatsapp_message/i);
  assert.match(migration, /p_content_type text/i);
  assert.match(migration, /apply_whatsapp_message_status/i);
  assert.doesNotMatch(migration, /\b(drop table|truncate|delete from)\b/i);
  assert.doesNotMatch(migration, /\balter table public\.(?!msg_)/i);
});

test("WhatsApp webhook rollback removes only its queue and helper functions", async () => {
  const rollback = await readFile(rollbackUrl, "utf8");
  const droppedObjects = Array.from(
    rollback.matchAll(/drop (?:function|table) if exists public\.([a-z_]+)/gi),
    (match) => match[1].toLowerCase(),
  );

  assert.deepEqual(droppedObjects, [
    "apply_whatsapp_message_status",
    "record_inbound_whatsapp_message",
    "msg_webhook_events",
  ]);
  assert.match(rollback, /record_inbound_whatsapp_message\(uuid, text, text, text, text, text, timestamptz, boolean\)/i);
  assert.doesNotMatch(rollback, /\bcascade\b/i);
});
