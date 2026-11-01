import type { NormalizedInboundMessage } from "./types";

const MAX_NORMALIZED_EVENTS = 1000;

export type PageMessagingChannel = "messenger" | "instagram";
type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredId(value: unknown): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 255) {
    throw new PageMessagingWebhookPayloadError("invalid_payload");
  }
  return value;
}

function parseTimestamp(value: unknown): string {
  const timestamp = typeof value === "number" ? String(value) : value;
  if (typeof timestamp !== "string" || !/^\d{1,16}$/.test(timestamp)) {
    throw new PageMessagingWebhookPayloadError("invalid_payload");
  }
  const milliseconds = Number(timestamp);
  const date = new Date(milliseconds);
  if (!Number.isSafeInteger(milliseconds) || Number.isNaN(date.getTime())) {
    throw new PageMessagingWebhookPayloadError("invalid_payload");
  }
  return date.toISOString();
}

export class PageMessagingWebhookPayloadError extends Error {
  constructor(readonly code: "invalid_payload" | "account_mismatch") {
    super(code);
    this.name = "PageMessagingWebhookPayloadError";
  }
}

export function parsePageMessagingWebhookPayload(
  payload: unknown,
  expectedAccountId: string,
  object: "page" | "instagram",
  channel: PageMessagingChannel,
): NormalizedInboundMessage[] {
  if (!isRecord(payload) || payload.object !== object || !Array.isArray(payload.entry)) {
    throw new PageMessagingWebhookPayloadError("invalid_payload");
  }
  if (!expectedAccountId) throw new PageMessagingWebhookPayloadError("account_mismatch");

  const events: NormalizedInboundMessage[] = [];
  for (const entryValue of payload.entry) {
    if (!isRecord(entryValue)) throw new PageMessagingWebhookPayloadError("invalid_payload");
    const accountId = requiredId(entryValue.id);
    if (accountId !== expectedAccountId) {
      throw new PageMessagingWebhookPayloadError("account_mismatch");
    }
    if (!Array.isArray(entryValue.messaging)) {
      if (entryValue.messaging === undefined) continue;
      throw new PageMessagingWebhookPayloadError("invalid_payload");
    }

    for (const webhookValue of entryValue.messaging) {
      if (!isRecord(webhookValue)) throw new PageMessagingWebhookPayloadError("invalid_payload");
      if (webhookValue.message === undefined) continue;
      if (!isRecord(webhookValue.message)) {
        throw new PageMessagingWebhookPayloadError("invalid_payload");
      }
      const message = webhookValue.message;
      if (message.is_echo === true || (channel === "instagram" && message.is_deleted === true)) {
        continue;
      }
      if (!isRecord(webhookValue.sender) || !isRecord(webhookValue.recipient)) {
        throw new PageMessagingWebhookPayloadError("invalid_payload");
      }

      const senderId = requiredId(webhookValue.sender.id);
      const recipientId = requiredId(webhookValue.recipient.id);
      if (recipientId !== expectedAccountId) {
        throw new PageMessagingWebhookPayloadError("account_mismatch");
      }
      if (senderId === expectedAccountId) continue;

      const text = message.text;
      let normalizedText: string | null;
      let contentType: "text" | "non_text";
      if (typeof text === "string" && text.length > 0 && text.length <= 30000) {
        normalizedText = text;
        contentType = "text";
      } else if (
        (text === undefined || text === null)
        && (
          Array.isArray(message.attachments)
          || isRecord(message.quick_reply)
          || (
            channel === "instagram"
            && (message.is_unsupported === true || isRecord(message.referral))
          )
        )
      ) {
        normalizedText = null;
        contentType = "non_text";
      } else {
        throw new PageMessagingWebhookPayloadError("invalid_payload");
      }

      if (events.length >= MAX_NORMALIZED_EVENTS) {
        throw new PageMessagingWebhookPayloadError("invalid_payload");
      }
      const externalMessageId = requiredId(message.mid);
      events.push({
        channel,
        externalEventId: externalMessageId,
        externalMessageId,
        externalContactId: senderId,
        receivedAt: parseTimestamp(webhookValue.timestamp),
        contentType,
        text: normalizedText,
      });
    }
  }
  return events;
}
