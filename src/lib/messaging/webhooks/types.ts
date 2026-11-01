import type { MessagingChannel } from "../channels/types";

export interface NormalizedInboundMessage {
  channel: MessagingChannel;
  externalEventId: string;
  externalMessageId: string;
  externalContactId: string;
  displayName?: string;
  receivedAt: string;
  text: string | null;
}
