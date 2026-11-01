import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  getMessagingSendLimits,
  isMessagingDryRun,
  isMessagingEnabled,
  isWhatsAppLiveSendEnabled,
} from "../config";
import type {
  SendDecision,
  SendMessageRequest,
  SendRefusalReason,
} from "./types";

const REFUSAL_REASONS = new Set<SendRefusalReason>([
  "messaging_disabled",
  "live_sending_disabled",
  "contact_not_found",
  "no_inbound_message",
  "contact_opted_out",
  "consent_required",
  "outside_response_window",
  "template_not_approved",
  "channel_not_supported",
  "rate_limit_exceeded",
  "duplicate_message",
  "invalid_message",
]);

export class MessagingSendRulesError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "MessagingSendRulesError";
  }
}

interface DatabaseDecision {
  allowed: boolean;
  reason: string;
  message_id: string | null;
  dry_run: boolean;
}

function isDatabaseDecision(value: unknown): value is DatabaseDecision {
  return typeof value === "object"
    && value !== null
    && "allowed" in value
    && typeof value.allowed === "boolean"
    && "reason" in value
    && typeof value.reason === "string"
    && "message_id" in value
    && (typeof value.message_id === "string" || value.message_id === null)
    && "dry_run" in value
    && typeof value.dry_run === "boolean";
}

export async function canSend(request: SendMessageRequest): Promise<SendDecision> {
  const limits = getMessagingSendLimits();
  const messageType = request.message.type;
  const content = messageType === "free" ? request.message.content : null;
  const templateName = messageType === "template" ? request.message.templateName : null;
  const templateLanguage = messageType === "template" ? request.message.language : null;
  const { data, error } = await getSupabaseAdminClient().rpc("evaluate_messaging_send", {
    p_user_id: request.ownerUserId,
    p_actor_user_id: request.actorUserId,
    p_contact_id: request.contactId,
    p_channel: request.channel,
    p_content: content,
    p_message_type: messageType,
    p_template_name: templateName,
    p_template_language: templateLanguage,
    p_existing_message_id: request.draftMessageId ?? null,
    p_messaging_enabled: isMessagingEnabled(),
    p_dry_run: isMessagingDryRun(),
    p_live_send_enabled: isWhatsAppLiveSendEnabled(),
    p_max_contact_per_day: limits.maxContactPerDay,
    p_max_outbound_per_hour: limits.maxOutboundPerHour,
  });

  if (error) {
    console.error("Could not evaluate messaging send rules", { code: error.code });
    throw new MessagingSendRulesError("send_rules_evaluation_failed");
  }
  if (!Array.isArray(data) || data.length !== 1 || !isDatabaseDecision(data[0])) {
    throw new MessagingSendRulesError("invalid_send_rules_response");
  }

  const [decision] = data;
  if (decision.allowed) {
    if (!decision.message_id || decision.reason !== "allowed") {
      throw new MessagingSendRulesError("invalid_allowed_send_decision");
    }
    return {
      allowed: true,
      messageId: decision.message_id,
      dryRun: decision.dry_run,
    };
  }

  if (!REFUSAL_REASONS.has(decision.reason as SendRefusalReason)) {
    throw new MessagingSendRulesError("unknown_send_refusal_reason");
  }
  return {
    allowed: false,
    reason: decision.reason as SendRefusalReason,
    dryRun: decision.dry_run,
  };
}
