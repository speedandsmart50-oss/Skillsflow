import type { SendMessageRequest } from "../rules/types";

export interface ClaimedWhatsAppFollowup {
  id: string;
  user_id: string;
  contact_id: string;
  message_content: string;
  message_type: "free" | "template";
  template_name: string | null;
  template_language: string | null;
  approved_by: string;
  claim_token: string;
}

export interface FollowupWorkerDependencies {
  messagingEnabled: boolean;
  claim(limit: number): Promise<ClaimedWhatsAppFollowup[]>;
  send(request: SendMessageRequest): Promise<
    | { status: "denied"; reason: string }
    | { status: "draft"; messageId: string }
    | { status: "sent"; messageId: string; externalMessageId: string }
  >;
  complete(input: {
    followupId: string;
    claimToken: string;
    status: "sent" | "awaiting_approval" | "cancelled" | "failed";
    reason: string | null;
    resultMessageId: string | null;
  }): Promise<boolean>;
}

export interface FollowupWorkerSummary {
  claimed: number;
  sent: number;
  drafts: number;
  cancelled: number;
  failed: number;
  claimLost: number;
}

function isClaimedWhatsAppFollowup(value: unknown): value is ClaimedWhatsAppFollowup {
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

export function createWhatsAppFollowupWorker(dependencies: FollowupWorkerDependencies) {
  return async function run(): Promise<FollowupWorkerSummary> {
    const summary: FollowupWorkerSummary = {
      claimed: 0,
      sent: 0,
      drafts: 0,
      cancelled: 0,
      failed: 0,
      claimLost: 0,
    };
    if (!dependencies.messagingEnabled) return summary;

    const claimed = await dependencies.claim(5);
    if (!Array.isArray(claimed) || !claimed.every(isClaimedWhatsAppFollowup)) {
      throw new Error("invalid_followup_claim_response");
    }
    summary.claimed = claimed.length;

    for (const followup of claimed) {
      let outcome: {
        status: "sent" | "awaiting_approval" | "cancelled" | "failed";
        reason: string | null;
        resultMessageId: string | null;
      };
      try {
        const request: SendMessageRequest = {
          ownerUserId: followup.user_id,
          actorUserId: followup.approved_by,
          contactId: followup.contact_id,
          channel: "whatsapp",
          message: followup.message_type === "template"
            ? {
              type: "template",
              templateName: followup.template_name ?? "",
              language: followup.template_language ?? "",
            }
            : { type: "free", content: followup.message_content },
        };
        const result = await dependencies.send(request);
        if (result.status === "denied") {
          outcome = {
            status: "cancelled",
            reason: result.reason,
            resultMessageId: null,
          };
          summary.cancelled += 1;
        } else if (result.status === "draft") {
          outcome = {
            status: "awaiting_approval",
            reason: "dry_run_requires_message_approval",
            resultMessageId: result.messageId,
          };
          summary.drafts += 1;
        } else {
          outcome = {
            status: "sent",
            reason: null,
            resultMessageId: result.messageId,
          };
          summary.sent += 1;
        }
      } catch (error) {
        outcome = {
          status: "failed",
          reason: "send_failed_requires_manual_review",
          resultMessageId: null,
        };
        summary.failed += 1;
        console.error("WhatsApp follow-up send failed and requires manual review", {
          followupId: followup.id,
          error: error instanceof Error ? error.message : "unknown_error",
        });
      }

      try {
        const completed = await dependencies.complete({
          followupId: followup.id,
          claimToken: followup.claim_token,
          ...outcome,
        });
        if (!completed) {
          summary.claimLost += 1;
          console.error("WhatsApp follow-up completion lost its claim", {
            followupId: followup.id,
          });
        }
      } catch {
        summary.failed += 1;
        console.error("Could not finalize WhatsApp follow-up", {
          followupId: followup.id,
        });
      }
    }

    return summary;
  };
}
