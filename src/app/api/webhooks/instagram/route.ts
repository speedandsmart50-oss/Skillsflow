import { enqueueInstagramWebhook, processInstagramWebhookQueueEvent } from "@/lib/messaging/webhooks/instagram-queue";
import { parseInstagramWebhookPayload } from "@/lib/messaging/webhooks/instagram-parser";
import { createPageWebhookHandlers } from "@/lib/messaging/webhooks/page-webhook-handler";

export const maxDuration = 60;

const handlers = createPageWebhookHandlers({
  channel: "instagram",
  accountIdEnvironmentVariable: "INSTAGRAM_ACCOUNT_ID",
  parsePayload: parseInstagramWebhookPayload,
  enqueue: enqueueInstagramWebhook,
  process: processInstagramWebhookQueueEvent,
});

export const GET = handlers.GET;
export const POST = handlers.POST;
