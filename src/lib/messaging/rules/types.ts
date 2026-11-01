import type { MessagingChannel } from "../channels/types";

export type SendRefusalReason =
  | "messaging_disabled"
  | "live_sending_disabled"
  | "contact_not_found"
  | "no_inbound_message"
  | "contact_opted_out"
  | "consent_required"
  | "outside_response_window"
  | "template_not_approved"
  | "channel_not_supported"
  | "rate_limit_exceeded"
  | "duplicate_message"
  | "invalid_message";

export type SendDecision =
  | { allowed: true; messageId: string; dryRun: boolean }
  | { allowed: false; reason: SendRefusalReason; dryRun: boolean };

export type SendMessage =
  | { type: "free"; content: string }
  | { type: "template"; templateName: string; language: string };

export interface SendMessageRequest {
  ownerUserId: string;
  actorUserId: string;
  contactId: string;
  channel: MessagingChannel;
  message: SendMessage;
  draftMessageId?: string;
}
