import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  MessengerWebhookPayloadError,
  parseMessengerWebhookPayload,
} from "../src/lib/messaging/webhooks/messenger-parser";

const routeUrl = new URL(
  "../src/app/api/webhooks/messenger/route.ts",
  import.meta.url,
);
const handlerUrl = new URL(
  "../src/lib/messaging/webhooks/page-webhook-handler.ts",
  import.meta.url,
);
const migrationUrl = new URL(
  "../supabase/migrations/053_messenger_inbound.sql",
  import.meta.url,
);
const rollbackUrl = new URL(
  "../supabase/rollback/053_messenger_inbound.down.sql",
  import.meta.url,
);

function payload(messaging: unknown[]) {
  return {
    object: "page",
    entry: [{ id: "page-123", messaging }],
  };
}

test("Messenger webhook normalizes inbound text and non-text messages", () => {
  const events = parseMessengerWebhookPayload(payload([
    {
      sender: { id: "psid-1" },
      recipient: { id: "page-123" },
      timestamp: 1749416383000,
      message: { mid: "mid.text-1", text: "STOP" },
    },
    {
      sender: { id: "psid-2" },
      recipient: { id: "page-123" },
      timestamp: "1749416384000",
      message: { mid: "mid.image-1", attachments: [{ type: "image" }] },
    },
  ]), "page-123");

  assert.deepEqual(events, [
    {
      channel: "messenger",
      externalEventId: "mid.text-1",
      externalMessageId: "mid.text-1",
      externalContactId: "psid-1",
      receivedAt: "2025-06-08T20:59:43.000Z",
      contentType: "text",
      text: "STOP",
    },
    {
      channel: "messenger",
      externalEventId: "mid.image-1",
      externalMessageId: "mid.image-1",
      externalContactId: "psid-2",
      receivedAt: "2025-06-08T20:59:44.000Z",
      contentType: "non_text",
      text: null,
    },
  ]);
});

test("Messenger webhook ignores echoes and non-message notifications", () => {
  const events = parseMessengerWebhookPayload(payload([
    { sender: { id: "page-123" }, recipient: { id: "psid" }, timestamp: 1, message: { mid: "echo", is_echo: true } },
    { sender: { id: "psid" }, recipient: { id: "page-123" }, timestamp: 2, delivery: { mids: ["sent"] } },
  ]), "page-123");
  assert.deepEqual(events, []);
});

test("Messenger webhook rejects malformed payloads and unrelated Pages", () => {
  assert.throws(
    () => parseMessengerWebhookPayload(payload([]), "another-page"),
    (error: unknown) => error instanceof MessengerWebhookPayloadError
      && error.code === "account_mismatch",
  );
  assert.throws(
    () => parseMessengerWebhookPayload(payload([{
      sender: { id: "psid" },
      recipient: { id: "wrong-page" },
      timestamp: 1,
      message: { mid: "message", text: "hello" },
    }]), "page-123"),
    (error: unknown) => error instanceof MessengerWebhookPayloadError
      && error.code === "account_mismatch",
  );
  assert.throws(
    () => parseMessengerWebhookPayload(payload([{
      sender: { id: "psid" },
      recipient: { id: "page-123" },
      timestamp: "not-a-time",
      message: { mid: "message", text: "hello" },
    }]), "page-123"),
    MessengerWebhookPayloadError,
  );
});

test("Messenger webhook is disabled and persists only through guarded signed intake", async () => {
  const [route, handler] = await Promise.all([
    readFile(routeUrl, "utf8"),
    readFile(handlerUrl, "utf8"),
  ]);
  assert.match(handler, /if \(!isMessagingEnabled\(\)\) return disabledResponse\(\)/);
  assert.match(handler, /verifyMetaWebhookSignature/);
  assert.match(handler, /readBoundedMetaWebhookBody/);
  assert.match(route, /processMessengerWebhookQueueEvent/);
  assert.match(route, /MESSENGER_PAGE_ID/);
});

test("Messenger migration adds channel-specific idempotent recording and guarded rollback", async () => {
  const [migration, rollback] = await Promise.all([
    readFile(migrationUrl, "utf8"),
    readFile(rollbackUrl, "utf8"),
  ]);
  assert.match(migration, /check \(channel in \('whatsapp', 'messenger'\)\)/i);
  assert.match(migration, /create function public\.record_inbound_messenger_message/i);
  assert.match(migration, /on conflict \(user_id, channel, external_message_id\) do nothing/i);
  assert.match(migration, /p_opt_out/i);
  assert.match(rollback, /Cannot roll back Messenger intake while queued or retained webhook events exist/i);
});
