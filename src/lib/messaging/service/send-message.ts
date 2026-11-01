import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { isWhatsAppLiveSendEnabled } from "../config";
import { createWhatsAppChannelAdapter, WhatsAppChannelError } from "../channels/whatsapp";
import { canSend } from "../rules/can-send";
import type { SendMessageRequest } from "../rules/types";
import { createMessagingSendCoordinator } from "./send-coordinator";

export class MessagingSendError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "MessagingSendError";
  }
}

async function sendApprovedWhatsAppMessage(
  request: SendMessageRequest,
  messageId: string,
): Promise<{ externalMessageId: string }> {
  if (!isWhatsAppLiveSendEnabled()) {
    throw new MessagingSendError("live_sending_disabled");
  }
  if (request.channel !== "whatsapp") {
    throw new MessagingSendError("unsupported_channel");
  }

  const supabase = getSupabaseAdminClient();
  try {
    const { data: contact, error: contactError } = await supabase
      .from("msg_contacts")
      .select("external_contact_id")
      .eq("id", request.contactId)
      .eq("user_id", request.ownerUserId)
      .eq("channel", "whatsapp")
      .maybeSingle();
    if (contactError) throw new MessagingSendError("contact_lookup_failed");
    if (!contact || !/^\d{3,20}$/.test(contact.external_contact_id)) {
      throw new MessagingSendError("contact_not_sendable");
    }

    const adapter = createWhatsAppChannelAdapter({
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? "",
      apiVersion: process.env.META_API_VERSION ?? "",
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
    });
    const contactReference = {
      id: request.contactId,
      channel: "whatsapp" as const,
      externalId: contact.external_contact_id,
    };
    const sent = request.message.type === "template"
      ? await adapter.sendTemplate(contactReference, {
        name: request.message.templateName,
        language: request.message.language,
      })
      : await adapter.sendText(contactReference, request.message.content);

    return sent;
  } catch (error) {
    const errorCode = error instanceof WhatsAppChannelError
      ? error.code
      : error instanceof MessagingSendError
        ? error.code
        : "whatsapp_send_failed";
    const { data: failedMessage, error: updateError } = await supabase
      .from("msg_messages")
      .update({ status: "failed", error_code: errorCode })
      .eq("id", messageId)
      .eq("user_id", request.ownerUserId)
      .eq("channel", "whatsapp")
      .eq("direction", "outbound")
      .eq("status", "approved")
      .select("id")
      .maybeSingle();
    if (updateError || !failedMessage) {
      console.error("Could not record failed WhatsApp send", {
        messageId,
        code: updateError?.code ?? "message_not_updated",
      });
      throw new MessagingSendError("send_failure_persistence_failed");
    }
    throw new MessagingSendError(errorCode);
  }
}

async function sendAuthorizedMessage(
  request: SendMessageRequest,
  messageId: string,
): Promise<{ externalMessageId: string }> {
  const supabase = getSupabaseAdminClient();
  const sent = await sendApprovedWhatsAppMessage(request, messageId);
  const { data: updatedMessage, error } = await supabase
    .from("msg_messages")
    .update({
      status: "sent",
      external_message_id: sent.externalMessageId,
      sent_at: new Date().toISOString(),
    })
    .eq("id", messageId)
    .eq("user_id", request.ownerUserId)
    .eq("channel", "whatsapp")
    .eq("direction", "outbound")
    .eq("status", "approved")
    .select("id")
    .maybeSingle();

  if (error || !updatedMessage) {
    console.error("WhatsApp accepted a message but local status update failed", {
      messageId,
      code: error?.code ?? "message_not_updated",
    });
    throw new MessagingSendError("send_result_persistence_failed");
  }
  return sent;
}

const coordinateSend = createMessagingSendCoordinator({
  authorize: canSend,
  send: sendAuthorizedMessage,
});

export async function sendMessagingMessage(request: SendMessageRequest) {
  return coordinateSend(request);
}
