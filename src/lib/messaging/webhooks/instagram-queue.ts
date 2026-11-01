import "server-only";

import {
  enqueuePageMessagingWebhook,
  processPageMessagingWebhookQueueEvent,
} from "./page-messaging-queue";
import type { NormalizedInboundMessage } from "./types";

export function enqueueInstagramWebhook(eventHash: string, events: NormalizedInboundMessage[]) {
  return enqueuePageMessagingWebhook("instagram", eventHash, events);
}

export function processInstagramWebhookQueueEvent(eventId: string) {
  return processPageMessagingWebhookQueueEvent(eventId, "instagram");
}
