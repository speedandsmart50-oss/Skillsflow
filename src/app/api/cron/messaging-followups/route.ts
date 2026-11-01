import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { isMessagingEnabled } from "@/lib/messaging/config";
import {
  createWhatsAppFollowupWorker,
  type ClaimedWhatsAppFollowup,
} from "@/lib/messaging/service/followup-worker";
import { sendMessagingMessage } from "@/lib/messaging/service/send-message";

export const maxDuration = 60;

function isClaimedFollowup(value: unknown): value is ClaimedWhatsAppFollowup {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string"
    && typeof row.user_id === "string"
    && typeof row.contact_id === "string"
    && typeof row.message_content === "string"
    && (row.message_type === "free" || row.message_type === "template")
    && (typeof row.template_name === "string" || row.template_name === null)
    && (typeof row.template_language === "string" || row.template_language === null)
    && typeof row.approved_by === "string"
    && typeof row.claim_token === "string";
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Accès refusé." }, { status: 401 });
  }

  if (!isMessagingEnabled()) {
    return Response.json(
      { enabled: false, claimed: 0, sent: 0, drafts: 0, cancelled: 0, failed: 0, claimLost: 0 },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const supabase = getSupabaseAdminClient();
  const worker = createWhatsAppFollowupWorker({
    messagingEnabled: true,
    claim: async (limit) => {
      const { data, error } = await supabase.rpc("claim_due_whatsapp_followups", {
        p_limit: limit,
        p_messaging_enabled: isMessagingEnabled(),
      });
      if (error) {
        console.error("Could not claim due WhatsApp follow-ups", { code: error.code });
        throw new Error("followup_claim_failed");
      }
      if (!Array.isArray(data) || !data.every(isClaimedFollowup)) {
        throw new Error("invalid_followup_claim_response");
      }
      return data;
    },
    send: async (sendRequest) => {
      const result = await sendMessagingMessage(sendRequest);
      if (result.status === "denied") {
        return { status: "denied", reason: result.reason };
      }
      if (result.status === "draft") {
        return { status: "draft", messageId: result.messageId };
      }
      return {
        status: "sent",
        messageId: result.messageId,
        externalMessageId: result.externalMessageId,
      };
    },
    complete: async (input) => {
      const { data, error } = await supabase.rpc("complete_whatsapp_followup", {
        p_followup_id: input.followupId,
        p_claim_token: input.claimToken,
        p_status: input.status,
        p_reason: input.reason,
        p_result_message_id: input.resultMessageId,
      });
      if (error) {
        console.error("Could not complete WhatsApp follow-up", { code: error.code });
        throw new Error("followup_completion_failed");
      }
      return data === true;
    },
  });

  try {
    const summary = await worker();
    return Response.json(
      { enabled: true, ...summary, runAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("WhatsApp follow-up worker failed", {
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return Response.json({ error: "Impossible de traiter les suivis." }, { status: 500 });
  }
}
