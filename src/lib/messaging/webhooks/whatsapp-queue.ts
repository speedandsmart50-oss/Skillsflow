import "server-only";

import { randomUUID } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { isMessagingOptOut, type NormalizedWhatsAppEvent } from "./whatsapp-parser";

const QUEUE_CLAIM_MS = 5 * 60 * 1000;

export class WhatsAppWebhookServiceError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "WhatsAppWebhookServiceError";
  }
}

export async function enqueueWhatsAppWebhook(
  eventHash: string,
  events: NormalizedWhatsAppEvent[],
): Promise<{ id: string; shouldProcess: boolean }> {
  const adminEmail = process.env.SKILLFLOW_ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) throw new WhatsAppWebhookServiceError("admin_owner_not_configured");

  const supabase = getSupabaseAdminClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,role")
    .eq("email", adminEmail)
    .maybeSingle();
  if (profileError) throw new WhatsAppWebhookServiceError("admin_owner_lookup_failed");
  if (!profile || profile.role !== "admin") {
    throw new WhatsAppWebhookServiceError("admin_owner_not_found");
  }

  const { error: insertError } = await supabase
    .from("msg_webhook_events")
    .upsert(
      {
        user_id: profile.id,
        channel: "whatsapp",
        event_hash: eventHash,
        payload: events,
      },
      { onConflict: "user_id,channel,event_hash", ignoreDuplicates: true },
    );
  if (insertError) throw new WhatsAppWebhookServiceError("webhook_event_enqueue_failed");

  const { data: queuedEvent, error: readError } = await supabase
    .from("msg_webhook_events")
    .select("id,status,claim_expires_at")
    .eq("user_id", profile.id)
    .eq("channel", "whatsapp")
    .eq("event_hash", eventHash)
    .maybeSingle();
  if (readError) throw new WhatsAppWebhookServiceError("webhook_event_lookup_failed");
  if (!queuedEvent) throw new WhatsAppWebhookServiceError("webhook_event_missing");

  const now = new Date();
  if (queuedEvent.status === "failed") {
    const { error } = await supabase
      .from("msg_webhook_events")
      .update({
        status: "pending",
        error_code: null,
        processed_at: null,
      })
      .eq("id", queuedEvent.id)
      .eq("status", "failed");
    if (error) throw new WhatsAppWebhookServiceError("webhook_event_retry_failed");
  } else if (
    queuedEvent.status === "processing"
    && queuedEvent.claim_expires_at
    && Date.parse(queuedEvent.claim_expires_at) <= now.getTime()
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
      .eq("id", queuedEvent.id)
      .eq("status", "processing")
      .lte("claim_expires_at", now.toISOString());
    if (error) throw new WhatsAppWebhookServiceError("webhook_event_recovery_failed");
  }

  const { data: current, error: currentError } = await supabase
    .from("msg_webhook_events")
    .select("status")
    .eq("id", queuedEvent.id)
    .maybeSingle();
  if (currentError) throw new WhatsAppWebhookServiceError("webhook_event_state_lookup_failed");

  return { id: queuedEvent.id, shouldProcess: current?.status === "pending" };
}

function isNormalizedWhatsAppEvent(value: unknown): value is NormalizedWhatsAppEvent {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  if (event.kind === "message") {
    if (typeof event.event !== "object" || event.event === null || Array.isArray(event.event)) {
      return false;
    }
    const message = event.event as Record<string, unknown>;
    return message.channel === "whatsapp"
      && typeof message.externalEventId === "string"
      && typeof message.externalMessageId === "string"
      && typeof message.externalContactId === "string"
      && (message.displayName === undefined || typeof message.displayName === "string")
      && typeof message.receivedAt === "string"
      && (message.contentType === "text" || message.contentType === "non_text")
      && (message.text === null || typeof message.text === "string");
  }
  return event.kind === "status"
    && typeof event.eventId === "string"
    && typeof event.externalMessageId === "string"
    && ["sent", "delivered", "read", "failed"].includes(String(event.status))
    && typeof event.receivedAt === "string"
    && (event.errorCode === undefined || typeof event.errorCode === "string");
}

async function processWhatsAppEvent(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  userId: string,
  queuedItem: NormalizedWhatsAppEvent,
): Promise<void> {
  if (queuedItem.kind === "message") {
    const { event } = queuedItem;
    const { error } = await supabase.rpc("record_inbound_whatsapp_message", {
      p_user_id: userId,
      p_external_contact_id: event.externalContactId,
      p_display_name: event.displayName ?? null,
      p_external_message_id: event.externalMessageId,
      p_content: event.text ?? "",
      p_content_type: event.contentType,
      p_received_at: event.receivedAt,
      p_opt_out: isMessagingOptOut(event.text),
    });
    if (error) throw new WhatsAppWebhookServiceError("inbound_message_record_failed");
  } else {
    const { error } = await supabase.rpc("apply_whatsapp_message_status", {
      p_user_id: userId,
      p_external_message_id: queuedItem.externalMessageId,
      p_status: queuedItem.status,
      p_error_code: queuedItem.errorCode ?? null,
      p_status_at: queuedItem.receivedAt,
    });
    if (error) throw new WhatsAppWebhookServiceError("message_status_update_failed");
  }
}

async function markWebhookEventFailed(
  eventId: string,
  claimToken: string,
): Promise<void> {
  const { error } = await getSupabaseAdminClient()
    .from("msg_webhook_events")
    .update({
      status: "failed",
      claim_token: null,
      claimed_at: null,
      claim_expires_at: null,
      error_code: "processing_failed",
    })
    .eq("id", eventId)
    .eq("claim_token", claimToken);
  if (error) throw new WhatsAppWebhookServiceError("webhook_event_failure_update_failed");
}

export async function processWhatsAppWebhookQueueEvent(eventId: string): Promise<void> {
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
    .eq("status", "pending")
    .select("id,user_id,payload")
    .maybeSingle();
  if (claimError) {
    console.error("Could not claim WhatsApp webhook event", { eventId });
    return;
  }
  if (!queuedEvent) return;

  try {
    if (!Array.isArray(queuedEvent.payload) || !queuedEvent.payload.every(isNormalizedWhatsAppEvent)) {
      throw new WhatsAppWebhookServiceError("invalid_queued_payload");
    }

    for (let offset = 0; offset < queuedEvent.payload.length; offset += 25) {
      const batch = queuedEvent.payload.slice(offset, offset + 25);
      const results = await Promise.allSettled(
        batch.map((queuedItem) => processWhatsAppEvent(supabase, queuedEvent.user_id, queuedItem)),
      );
      if (results.some((result) => result.status === "rejected")) {
        throw new WhatsAppWebhookServiceError("webhook_event_batch_processing_failed");
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
      .eq("claim_token", claimToken)
      .select("id")
      .maybeSingle();
    if (completeError) throw new WhatsAppWebhookServiceError("webhook_event_completion_failed");
    if (!completedEvent) throw new WhatsAppWebhookServiceError("webhook_event_claim_lost");
  } catch (error) {
    try {
      await markWebhookEventFailed(eventId, claimToken);
    } catch {
      console.error("Could not mark WhatsApp webhook event as failed", { eventId });
    }
    console.error("WhatsApp webhook event processing failed", {
      eventId,
      error: error instanceof Error ? error.name : "UnknownError",
    });
  }
}
