import {
  PageMessagingWebhookPayloadError,
  parsePageMessagingWebhookPayload,
} from "./page-messaging-parser";

export { PageMessagingWebhookPayloadError as MessengerWebhookPayloadError };

export function parseMessengerWebhookPayload(payload: unknown, pageId: string) {
  return parsePageMessagingWebhookPayload(payload, pageId, "page", "messenger");
}
