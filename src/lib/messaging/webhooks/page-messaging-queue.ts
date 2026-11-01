import "server-only";

import { randomUUID } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { isMessagingOptOut } from "./whatsapp-parser";
import type { NormalizedInboundMessage } from "./types";
import type { PageMessagingChannel } from "./page-messaging-parser";

const QUEUE_CLAIM_MS = 5 * 60 * 1000;

export class PageMessagingWebhookServiceError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "PageMessagingWebhookServiceError";
  }
}

export async function enqueuePageMessagingWebhook(
  channel: PageMessagingChannel,
  eventHash: string,
  events: NormalizedInboundMessage[],
): Promise<{ id: string; shouldProcess: boolean }> {
  if (!/^[a-f0-9]{64}$/.test(eventHash) || !events.every((event) => event.channel === channel)) {
    throw new PageMessagingWebhookServiceError("invalid_webhook_enqueue_input");
  }
  const adminEmail = process.env.SKILLFLOW_ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) throw new PageMessagingWebhookServiceError("admin_owner_not_configured");

  const supabase = getSupabaseAdminClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,role")
    .eq("email", adminEmail)
    .maybeSingle();
  if (profileError) throw new PageMessagingWebhookServiceError("admin_owner_lookup_failed");
  if (!profile || profile.role !== "admin") {
    throw new PageMessagingWebhookServiceError("admin_owner_not_found");
  }

  const { error: insertError } = await supabase
    .from("msg_webhook_events")
    .upsert(
      { user_id: profile.id, channel, event_hash: eventHash, payload: events },
      { onConflict: "user_id,channel,event_hash", ignoreDuplicates: true },
    );
  if (insertError) throw new PageMessagingWebhookServiceError("webhook_event_enqueue_failed");

  const { data: event, error: readError } = await supabase
    .from("msg_webhook_events")
    .select("id,status,claim_expires_at")
    .eq("user_id", profile.id)
    .eq("channel", channel)
    .eq("event_hash", eventHash)
    .maybeSingle();
  if (readError) throw new PageMessagingWebhookServiceError("webhook_event_lookup_failed");
  if (!event) throw new PageMessagingWebhookServiceError("webhook_event_missing");

  const now = new Date();
  if (event.status === "failed") {
    const { error } = await supabase
      .from("msg_webhook_events")
      .update({ status: "pending", error_code: null, processed_at: null })
      .eq("id", event.id)
      .eq("status", "failed");
    if (error) throw new PageMessagingWebhookServiceError("webhook_event_retry_failed");
  } else if (
    event.status === "processing"
    && event.claim_expires_at
    && Date.parse(event.claim_expires_at) <= now.getTime()
  ) {
    const { error } = await supabase
      .from("msg_webhook_events")
      .update({
        status: "pending",
        claim_token: null,
        claimed_at: null,
        claim_expires_at: null,
        error_code: null,
      })
      .eq("id", event.id)
      .eq("status", "processing")
      .lte("claim_expires_at", now.toISOString());
    if (error) throw new PageMessagingWebhookServiceError("webhook_event_recovery_failed");
  }

  const { data: current, error: currentError } = await supabase
    .from("msg_webhook_events")
    .select("status")
    .eq("id", event.id)
    .maybeSingle();
  if (currentError) throw new PageMessagingWebhookServiceError("webhook_event_state_lookup_failed");
  return { id: event.id, shouldProcess: current?.status === "pending" };
}

function isNormalizedPageMessagingMessage(
  value: unknown,
  channel: PageMessagingChannel,
): value is NormalizedInboundMessage {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const message = value as Record<string, unknown>;
  return message.channel === channel
    && typeof message.externalEventId === "string"
    && message.externalEventId.length > 0
    && message.externalEventId.length <= 255
    && typeof message.externalMessageId === "string"
    && message.externalMessageId.length > 0
    && message.externalMessageId.length <= 255
    && typeof message.externalContactId === "string"
    && message.externalContactId.length > 0
    && message.externalContactId.length <= 255
    && typeof message.receivedAt === "string"
    && (message.contentType === "text" || message.contentType === "non_text")
    && (
      (message.contentType === "text" && typeof message.text === "string"
        && message.text.length > 0 && message.text.length <= 30000)
      || (message.contentType === "non_text" && message.text === null)
    );
}

export async function processPageMessagingWebhookQueueEvent(
  eventId: string,
  channel: PageMessagingChannel,
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const claimToken = randomUUID();
  const claimedAt = new Date();
  const { data: queuedEvent, error: claimError } = await supabase
    .from("msg_webhook_events")
    .update({
      status: "processing",
      claim_token: claimToken,
      claimed_at: claimedAt.toISOString(),
      claim_expires_at: new Date(claimedAt.getTime() + QUEUE_CLAIM_MS).toISOString(),
    })
    .eq("id", eventId)
    .eq("channel", channel)
    .eq("status", "pending")
    .select("id,user_id,payload")
    .maybeSingle();
  if (claimError) {
    console.error("Could not claim Meta page messaging webhook event", { eventId, channel });
    return;
  }
  if (!queuedEvent) return;

  try {
    if (!Array.isArray(queuedEvent.payload) || !queuedEvent.payload.every(
      (message) => isNormalizedPageMessagingMessage(message, channel),
    )) {
      throw new PageMessagingWebhookServiceError("invalid_queued_payload");
    }

    for (let offset = 0; offset < queuedEvent.payload.length; offset += 25) {
      const batch = queuedEvent.payload.slice(offset, offset + 25);
      const results = await Promise.allSettled(batch.map(async (message) => {
        const { error } = await supabase.rpc(`record_inbound_${channel}_message`, {
          p_user_id: queuedEvent.user_id,
          p_external_contact_id: message.externalContactId,
          p_external_message_id: message.externalMessageId,
          p_content: message.text ?? "",
          p_content_type: message.contentType,
          p_received_at: message.receivedAt,
          p_opt_out: isMessagingOptOut(message.text),
        });
        if (error) throw new PageMessagingWebhookServiceError("inbound_message_record_failed");
      }));
      if (results.some((result) => result.status === "rejected")) {
        throw new PageMessagingWebhookServiceError("webhook_event_batch_processing_failed");
      }
    }

    const { data: completedEvent, error: completeError } = await supabase
      .from("msg_webhook_events")
      .update({
        status: "processed",
        payload: [],
        claim_token: null,
        claimed_at: null,
        claim_expires_at: null,
        error_code: null,
        processed_at: new Date().toISOString(),
      })
      .eq("id", eventId)
      .eq("channel", channel)
      .eq("claim_token", claimToken)
      .select("id")
      .maybeSingle();
    if (completeError) throw new PageMessagingWebhookServiceError("webhook_event_completion_failed");
    if (!completedEvent) throw new PageMessagingWebhookServiceError("webhook_event_claim_lost");
  } catch (error) {
    const { error: failureError } = await supabase
      .from("msg_webhook_events")
      .update({
        status: "failed",
        claim_token: null,
        claimed_at: null,
        claim_expires_at: null,
        error_code: "processing_failed",
      })
      .eq("id", eventId)
      .eq("channel", channel)
      .eq("claim_token", claimToken);
    if (failureError) {
      console.error("Could not mark Meta page messaging webhook event as failed", {
        eventId,
        channel,
      });
    }
    console.error("Meta page messaging webhook event processing failed", {
      eventId,
      channel,
      error: error instanceof Error ? error.name : "UnknownError",
    });
  }
}
