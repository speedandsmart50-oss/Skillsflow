import { enqueueMessengerWebhook, processMessengerWebhookQueueEvent } from "@/lib/messaging/webhooks/messenger-queue";
import { parseMessengerWebhookPayload } from "@/lib/messaging/webhooks/messenger-parser";
import { createPageWebhookHandlers } from "@/lib/messaging/webhooks/page-webhook-handler";

export const maxDuration = 60;

const handlers = createPageWebhookHandlers({
  channel: "messenger",
  accountIdEnvironmentVariable: "MESSENGER_PAGE_ID",
  parsePayload: parseMessengerWebhookPayload,
  enqueue: enqueueMessengerWebhook,
  process: processMessengerWebhookQueueEvent,
});

export const GET = handlers.GET;
export const POST = handlers.POST;
