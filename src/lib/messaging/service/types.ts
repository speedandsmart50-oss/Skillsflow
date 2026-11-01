import type { MessagingContactReference, MessagingChannel } from "../channels/types";

export type MessagingContactStatus =
  | "new"
  | "in_discussion"
  | "interested"
  | "converted"
  | "opted_out";

export interface MessagingContact extends MessagingContactReference {
  displayName: string | null;
  status: MessagingContactStatus;
  lastInboundAt: string | null;
}

export interface MessagingMessage {
  id: string;
  contactId: string;
  channel: MessagingChannel;
  direction: "inbound" | "outbound";
  content: string;
  status: "draft" | "approved" | "sent" | "delivered" | "read" | "failed";
  createdAt: string;
}
