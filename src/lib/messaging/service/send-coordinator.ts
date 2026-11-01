import type {
  SendDecision,
  SendMessageRequest,
  SendRefusalReason,
} from "../rules/types";

export type MessagingSendResult =
  | { status: "denied"; reason: SendRefusalReason; dryRun: boolean }
  | { status: "draft"; messageId: string; dryRun: true }
  | { status: "sent"; messageId: string; externalMessageId: string; dryRun: false };

interface SendCoordinatorDependencies {
  authorize(request: SendMessageRequest): Promise<SendDecision>;
  send(request: SendMessageRequest, messageId: string): Promise<{ externalMessageId: string }>;
}

export function createMessagingSendCoordinator(
  dependencies: SendCoordinatorDependencies,
) {
  return async function sendMessage(
    request: SendMessageRequest,
  ): Promise<MessagingSendResult> {
    const decision = await dependencies.authorize(request);
    if (!decision.allowed) {
      return {
        status: "denied",
        reason: decision.reason,
        dryRun: decision.dryRun,
      };
    }

    if (decision.dryRun) {
      return {
        status: "draft",
        messageId: decision.messageId,
        dryRun: true,
      };
    }

    if (request.channel !== "whatsapp") {
      throw new Error("An unsupported channel passed the send policy.");
    }

    const result = await dependencies.send(request, decision.messageId);
    return {
      status: "sent",
      messageId: decision.messageId,
      externalMessageId: result.externalMessageId,
      dryRun: false,
    };
  };
}
