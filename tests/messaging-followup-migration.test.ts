import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/052_messaging_followup_scheduler.sql",
  import.meta.url,
);
const rollbackUrl = new URL(
  "../supabase/rollback/052_messaging_followup_scheduler.down.sql",
  import.meta.url,
);

test("follow-up migration preserves legacy sent rows and bounds visible scheduling jitter", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /jitter_seconds integer not null default 0\s+check \(jitter_seconds between 0 and 900\)/i);
  assert.match(migration, /floor\(random\(\) \* 901\)::integer/i);
  assert.match(migration, /status = 'sent' and \(\s*\(approved_at is not null and approved_by is not null\)\s*or \(approved_at is null and approved_by is null\)/i);
  assert.match(migration, /status = 'sent'\)\s*or \(status not in \('awaiting_approval', 'sent'\) and result_message_id is null\)/i);
  assert.match(migration, /for update skip locked/i);
  assert.match(migration, /claim_expired_requires_manual_review/i);
  assert.match(migration, /p_status not in \('sent', 'awaiting_approval'\)/i);
  assert.match(migration, /create function public\.fail_whatsapp_followup_draft/i);
});

test("follow-up rollback drops new constraints before clearing new state", async () => {
  const rollback = await readFile(rollbackUrl, "utf8");
  const constraintsDrop = rollback.indexOf("drop constraint if exists msg_followups_approval_state_check");
  const stateUpdate = rollback.indexOf("update public.msg_followups");

  assert.notEqual(constraintsDrop, -1);
  assert.notEqual(stateUpdate, -1);
  assert.ok(constraintsDrop < stateUpdate);
  assert.match(rollback, /drop column if exists due_at/i);
  assert.match(rollback, /drop constraint if exists msg_messages_id_user_uq/i);
  assert.match(rollback, /drop function if exists public\.fail_whatsapp_followup_draft/i);
});
