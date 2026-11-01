import {
  PageMessagingWebhookPayloadError,
  parsePageMessagingWebhookPayload,
} from "./page-messaging-parser";

export { PageMessagingWebhookPayloadError as InstagramWebhookPayloadError };

export function parseInstagramWebhookPayload(payload: unknown, accountId: string) {
  return parsePageMessagingWebhookPayload(payload, accountId, "instagram", "instagram");
}
