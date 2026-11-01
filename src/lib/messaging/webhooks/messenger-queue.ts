import "server-only";

import {
  enqueuePageMessagingWebhook,
  processPageMessagingWebhookQueueEvent,
} from "./page-messaging-queue";
import type { NormalizedInboundMessage } from "./types";

export function enqueueMessengerWebhook(eventHash: string, events: NormalizedInboundMessage[]) {
  return enqueuePageMessagingWebhook("messenger", eventHash, events);
}

export function processMessengerWebhookQueueEvent(eventId: string) {
  return processPageMessagingWebhookQueueEvent(eventId, "messenger");
}
