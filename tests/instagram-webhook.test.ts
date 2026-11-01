import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  InstagramWebhookPayloadError,
  parseInstagramWebhookPayload,
} from "../src/lib/messaging/webhooks/instagram-parser";

const routeUrl = new URL(
  "../src/app/api/webhooks/instagram/route.ts",
  import.meta.url,
);
const migrationUrl = new URL(
  "../supabase/migrations/054_instagram_inbound.sql",
  import.meta.url,
);
const rollbackUrl = new URL(
  "../supabase/rollback/054_instagram_inbound.down.sql",
  import.meta.url,
);

function payload(messaging: unknown[]) {
  return {
    object: "instagram",
    entry: [{ id: "ig-account-123", messaging }],
  };
}

test("Instagram webhook normalizes customer text, media, and referrals only", () => {
  const events = parseInstagramWebhookPayload(payload([
    {
      sender: { id: "igsid-text" },
      recipient: { id: "ig-account-123" },
      timestamp: 1749416383000,
      message: { mid: "ig.mid.text", text: "Bonjour" },
    },
    {
      sender: { id: "igsid-media" },
      recipient: { id: "ig-account-123" },
      timestamp: 1749416384000,
      message: { mid: "ig.mid.media", attachments: [{ type: "image", payload: { url: "private" } }] },
    },
    {
      sender: { id: "igsid-referral" },
      recipient: { id: "ig-account-123" },
      timestamp: 1749416385000,
      message: { mid: "ig.mid.referral", referral: { source: "SHORTLINK" } },
    },
    {
      sender: { id: "igsid-unsupported" },
      recipient: { id: "ig-account-123" },
      timestamp: 1749416386000,
      message: { mid: "ig.mid.unsupported", is_unsupported: true },
    },
  ]), "ig-account-123");

  assert.equal(events.length, 4);
  assert.deepEqual(events.map((event) => ({
    channel: event.channel,
    externalMessageId: event.externalMessageId,
    contentType: event.contentType,
    text: event.text,
  })), [
    { channel: "instagram", externalMessageId: "ig.mid.text", contentType: "text", text: "Bonjour" },
    { channel: "instagram", externalMessageId: "ig.mid.media", contentType: "non_text", text: null },
    { channel: "instagram", externalMessageId: "ig.mid.referral", contentType: "non_text", text: null },
    { channel: "instagram", externalMessageId: "ig.mid.unsupported", contentType: "non_text", text: null },
  ]);
});

test("Instagram webhook ignores echoes, deletions, reactions, and standby events", () => {
  const events = parseInstagramWebhookPayload(payload([
    { sender: { id: "ig-account-123" }, recipient: { id: "igsid" }, timestamp: 1, message: { mid: "echo", is_echo: true } },
    { sender: { id: "igsid" }, recipient: { id: "ig-account-123" }, timestamp: 2, message: { mid: "deleted", is_deleted: true } },
    { sender: { id: "igsid" }, recipient: { id: "ig-account-123" }, timestamp: 3, message_reactions: { action: "react" } },
    { sender: { id: "igsid" }, recipient: { id: "ig-account-123" }, timestamp: 4, standby: { message: { mid: "standby" } } },
  ]), "ig-account-123");
  assert.deepEqual(events, []);
});

test("Instagram webhook rejects another account and malformed message shapes", () => {
  assert.throws(
    () => parseInstagramWebhookPayload(payload([]), "another-account"),
    (error: unknown) => error instanceof InstagramWebhookPayloadError
      && error.code === "account_mismatch",
  );
  assert.throws(
    () => parseInstagramWebhookPayload(payload([{
      sender: { id: "igsid" },
      recipient: { id: "wrong-account" },
      timestamp: 1,
      message: { mid: "mid", text: "Hello" },
    }]), "ig-account-123"),
    InstagramWebhookPayloadError,
  );
  assert.throws(
    () => parseInstagramWebhookPayload(payload([{
      sender: { id: "igsid" },
      recipient: { id: "ig-account-123" },
      timestamp: "not-a-time",
      message: { mid: "mid", text: "Hello" },
    }]), "ig-account-123"),
    InstagramWebhookPayloadError,
  );
});

test("Instagram route uses the shared gated webhook handler", async () => {
  const route = await readFile(routeUrl, "utf8");
  assert.match(route, /INSTAGRAM_ACCOUNT_ID/);
  assert.match(route, /parseInstagramWebhookPayload/);
  assert.match(route, /processInstagramWebhookQueueEvent/);
  assert.match(route, /createPageWebhookHandlers/);
});

test("Instagram migration records channel-scoped messages and guards rollback", async () => {
  const [migration, rollback] = await Promise.all([
    readFile(migrationUrl, "utf8"),
    readFile(rollbackUrl, "utf8"),
  ]);
  assert.match(migration, /check \(channel in \('whatsapp', 'messenger', 'instagram'\)\)/i);
  assert.match(migration, /create function public\.record_inbound_instagram_message/i);
  assert.match(migration, /on conflict \(user_id, channel, external_message_id\) do nothing/i);
  assert.match(rollback, /Cannot roll back Instagram intake while queued or retained webhook events exist/i);
});
