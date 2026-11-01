import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import {
  verifyMetaWebhookSignature,
  verifyMetaWebhookToken,
} from "../src/lib/messaging/webhooks/meta-signature";
import {
  isWhatsAppOptOut,
  parseWhatsAppWebhookPayload,
  WhatsAppWebhookPayloadError,
} from "../src/lib/messaging/webhooks/whatsapp-parser";

function createWebhookPayload() {
  const messages: Record<string, unknown>[] = [{
    from: "15551234567",
    id: "wamid.inbound",
    timestamp: "1749416383",
    type: "text",
    text: { body: "STOP" },
  }];

  return {
    object: "whatsapp_business_account",
    entry: [{
      id: "business-account-id",
      changes: [{
        field: "messages",
        value: {
          messaging_product: "whatsapp",
          metadata: {
            display_phone_number: "15550001111",
            phone_number_id: "phone-number-id",
          },
          contacts: [{
            profile: { name: "Ada" },
            wa_id: "15551234567",
          }],
          messages,
          statuses: [{
            id: "wamid.outbound",
            status: "read",
            timestamp: "1749416384",
          }],
        },
      }],
    }],
  };
}

test("Meta webhook verification compares tokens and validates HMAC over raw bytes", () => {
  const rawBody = Buffer.from('{"object":"whatsapp_business_account"}');
  const secret = "test-app-secret";
  const signature = createHmac("sha256", secret).update(rawBody).digest("hex");

  assert.equal(verifyMetaWebhookToken("expected-token", "expected-token"), true);
  assert.equal(verifyMetaWebhookToken("wrong-token", "expected-token"), false);
  assert.equal(verifyMetaWebhookToken("", "expected-token"), false);
  assert.equal(verifyMetaWebhookSignature(rawBody, `sha256=${signature}`, secret), true);
  assert.equal(verifyMetaWebhookSignature(rawBody, `sha256=${signature}`, "wrong-secret"), false);
  assert.equal(verifyMetaWebhookSignature(rawBody, `sha256=${"0".repeat(64)}`, secret), false);
  assert.equal(verifyMetaWebhookSignature(rawBody, signature, secret), false);
});

test("WhatsApp webhook payloads normalize inbound messages and statuses", () => {
  const events = parseWhatsAppWebhookPayload(
    createWebhookPayload(),
    "phone-number-id",
    "business-account-id",
  );

  assert.equal(events.length, 2);
  assert.deepEqual(events[0], {
    kind: "message",
    event: {
      channel: "whatsapp",
      externalEventId: "wamid.inbound",
      externalMessageId: "wamid.inbound",
      externalContactId: "15551234567",
      displayName: "Ada",
      receivedAt: "2025-06-08T20:59:43.000Z",
      contentType: "text",
      text: "STOP",
    },
  });
  assert.deepEqual(events[1], {
    kind: "status",
    eventId: "wamid.outbound:read:2025-06-08T20:59:44.000Z:",
    externalMessageId: "wamid.outbound",
    status: "read",
    receivedAt: "2025-06-08T20:59:44.000Z",
    errorCode: undefined,
  });
});

test("WhatsApp webhook parser rejects wrong phone IDs and malformed events", () => {
  assert.throws(
    () => parseWhatsAppWebhookPayload(createWebhookPayload(), "another-phone-id"),
    (error: unknown) => error instanceof WhatsAppWebhookPayloadError
      && error.code === "phone_number_mismatch",
  );
  assert.throws(
    () => parseWhatsAppWebhookPayload(
      createWebhookPayload(),
      "phone-number-id",
      "another-business-account-id",
    ),
    (error: unknown) => error instanceof WhatsAppWebhookPayloadError
      && error.code === "phone_number_mismatch",
  );
  assert.throws(
    () => parseWhatsAppWebhookPayload({ object: "page", entry: [] }, "phone-number-id"),
    WhatsAppWebhookPayloadError,
  );

  const malformed = createWebhookPayload();
  malformed.entry[0].changes[0].value.messages[0].timestamp = "not-a-timestamp";
  assert.throws(
    () => parseWhatsAppWebhookPayload(malformed, "phone-number-id"),
    WhatsAppWebhookPayloadError,
  );
});

test("WhatsApp webhook parser records non-text messages without interpreting their payload", () => {
  const payload = createWebhookPayload();
  payload.entry[0].changes[0].value.messages[0] = {
    from: "15551234567",
    id: "wamid.image",
    timestamp: "1749416383",
    type: "image",
    image: { id: "media-id", caption: "caption stays unprocessed" },
  };
  const [event] = parseWhatsAppWebhookPayload(payload, "phone-number-id");
  assert.equal(event.kind, "message");
  if (event.kind !== "message") return;
  assert.equal(event.event.contentType, "non_text");
  assert.equal(event.event.text, null);
});

test("WhatsApp opt-out detection recognizes exact commands but not incidental text", () => {
  assert.equal(isWhatsAppOptOut(" STOP! "), true);
  assert.equal(isWhatsAppOptOut("Arrêt"), true);
  assert.equal(isWhatsAppOptOut("unsubscribe"), true);
  assert.equal(isWhatsAppOptOut("please stop sending this"), false);
  assert.equal(isWhatsAppOptOut(null), false);
});
