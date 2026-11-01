import type { NormalizedInboundMessage } from "./types";

export type WhatsAppMessageStatus = "sent" | "delivered" | "read" | "failed";
const MAX_NORMALIZED_EVENTS = 1000;

function isWhatsAppMessageStatus(value: unknown): value is WhatsAppMessageStatus {
  return value === "sent" || value === "delivered" || value === "read" || value === "failed";
}

function appendEvent(events: NormalizedWhatsAppEvent[], event: NormalizedWhatsAppEvent): void {
  if (events.length >= MAX_NORMALIZED_EVENTS) {
    throw new WhatsAppWebhookPayloadError("invalid_payload");
  }
  events.push(event);
}

export type NormalizedWhatsAppEvent =
  | { kind: "message"; event: NormalizedInboundMessage }
  | {
      kind: "status";
      eventId: string;
      externalMessageId: string;
      status: WhatsAppMessageStatus;
      receivedAt: string;
      errorCode?: string;
    };

export class WhatsAppWebhookPayloadError extends Error {
  constructor(
    readonly code: "invalid_payload" | "phone_number_mismatch",
  ) {
    super(code);
    this.name = "WhatsAppWebhookPayloadError";
  }
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(
  value: unknown,
  maxLength: number,
  code: WhatsAppWebhookPayloadError["code"] = "invalid_payload",
): string {
  if (typeof value !== "string" || value.length < 1 || value.length > maxLength) {
    throw new WhatsAppWebhookPayloadError(code);
  }
  return value;
}

function timestamp(value: unknown): string {
  const seconds = requiredString(value, 16);
  if (!/^\d{1,16}$/.test(seconds)) throw new WhatsAppWebhookPayloadError("invalid_payload");

  const milliseconds = Number(seconds) * 1000;
  const date = new Date(milliseconds);
  if (!Number.isSafeInteger(milliseconds) || Number.isNaN(date.getTime())) {
    throw new WhatsAppWebhookPayloadError("invalid_payload");
  }
  return date.toISOString();
}

function optionalDisplayName(contacts: unknown, externalContactId: string): string | undefined {
  if (!Array.isArray(contacts)) return undefined;
  const contact = contacts.find((candidate) =>
    isRecord(candidate) && candidate.wa_id === externalContactId,
  );
  if (!isRecord(contact) || !isRecord(contact.profile) || typeof contact.profile.name !== "string") {
    return undefined;
  }
  return contact.profile.name.length <= 200 ? contact.profile.name : undefined;
}

function readArray(value: unknown): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new WhatsAppWebhookPayloadError("invalid_payload");
  return value;
}

function parseMessage(
  value: unknown,
  contacts: unknown,
): NormalizedWhatsAppEvent {
  if (!isRecord(value)) throw new WhatsAppWebhookPayloadError("invalid_payload");
  const externalMessageId = requiredString(value.id, 255);
  const externalContactId = requiredString(value.from, 255);
  const receivedAt = timestamp(value.timestamp);
  const messageType = requiredString(value.type, 80);

  let text: string | null = null;
  if (messageType === "text") {
    if (!isRecord(value.text)) throw new WhatsAppWebhookPayloadError("invalid_payload");
    text = requiredString(value.text.body, 30000);
  }

  return {
    kind: "message",
    event: {
      channel: "whatsapp",
      externalEventId: externalMessageId,
      externalMessageId,
      externalContactId,
      displayName: optionalDisplayName(contacts, externalContactId),
      receivedAt,
      text,
    },
  };
}

function parseStatus(value: unknown): NormalizedWhatsAppEvent {
  if (!isRecord(value)) throw new WhatsAppWebhookPayloadError("invalid_payload");
  const externalMessageId = requiredString(value.id, 255);
  const status = value.status;
  if (!isWhatsAppMessageStatus(status)) {
    throw new WhatsAppWebhookPayloadError("invalid_payload");
  }
  const receivedAt = timestamp(value.timestamp);
  if (value.errors !== undefined && !Array.isArray(value.errors)) {
    throw new WhatsAppWebhookPayloadError("invalid_payload");
  }
  const firstError = Array.isArray(value.errors) ? value.errors[0] : undefined;
  if (firstError !== undefined && !isRecord(firstError)) {
    throw new WhatsAppWebhookPayloadError("invalid_payload");
  }
  const rawErrorCode = isRecord(firstError) ? firstError.code : undefined;
  if (rawErrorCode !== undefined
    && (typeof rawErrorCode !== "number" || !Number.isSafeInteger(rawErrorCode))) {
    throw new WhatsAppWebhookPayloadError("invalid_payload");
  }
  const errorCode = typeof rawErrorCode === "number" ? String(rawErrorCode) : undefined;

  return {
    kind: "status",
    eventId: `${externalMessageId}:${status}:${receivedAt}:${errorCode ?? ""}`,
    externalMessageId,
    status,
    receivedAt,
    errorCode,
  };
}

export function parseWhatsAppWebhookPayload(
  payload: unknown,
  expectedPhoneNumberId: string,
): NormalizedWhatsAppEvent[] {
  if (!isRecord(payload) || payload.object !== "whatsapp_business_account"
    || !Array.isArray(payload.entry) || !expectedPhoneNumberId) {
    throw new WhatsAppWebhookPayloadError("invalid_payload");
  }

  const events: NormalizedWhatsAppEvent[] = [];
  for (const entry of payload.entry) {
    if (!isRecord(entry) || !Array.isArray(entry.changes)) {
      throw new WhatsAppWebhookPayloadError("invalid_payload");
    }

    for (const change of entry.changes) {
      if (!isRecord(change)) throw new WhatsAppWebhookPayloadError("invalid_payload");
      if (change.field !== "messages") continue;
      if (!isRecord(change.value) || !isRecord(change.value.metadata)
        || change.value.messaging_product !== "whatsapp") {
        throw new WhatsAppWebhookPayloadError("invalid_payload");
      }

      const phoneNumberId = requiredString(change.value.metadata.phone_number_id, 255);
      if (phoneNumberId !== expectedPhoneNumberId) {
        throw new WhatsAppWebhookPayloadError("phone_number_mismatch");
      }

      for (const message of readArray(change.value.messages)) {
        appendEvent(events, parseMessage(message, change.value.contacts));
      }
      for (const status of readArray(change.value.statuses)) {
        appendEvent(events, parseStatus(status));
      }
    }
  }

  return events;
}

const OPT_OUT_PHRASES = new Set([
  "STOP",
  "STOP ALL",
  "UNSUBSCRIBE",
  "CANCEL",
  "END",
  "QUIT",
  "ARRET",
]);

export function isWhatsAppOptOut(text: string | null): boolean {
  if (!text) return false;
  const normalized = text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toUpperCase()
    .replace(/[.!?]+$/, "");
  return OPT_OUT_PHRASES.has(normalized);
}
