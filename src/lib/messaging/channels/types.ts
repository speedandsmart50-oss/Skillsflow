export type MessagingChannel = "whatsapp" | "messenger" | "instagram";

export interface MessagingContactReference<TChannel extends MessagingChannel = MessagingChannel> {
  id: string;
  channel: TChannel;
  externalId: string;
}

export interface ApprovedMessageTemplate {
  name: string;
  language: string;
}

export interface ChannelSendResult {
  externalMessageId: string;
}

export interface MessagingChannelAdapter<TChannel extends MessagingChannel = MessagingChannel> {
  readonly channel: TChannel;
  sendText(
    contact: MessagingContactReference<TChannel>,
    text: string,
  ): Promise<ChannelSendResult>;
  sendTemplate(
    contact: MessagingContactReference<TChannel>,
    template: ApprovedMessageTemplate,
  ): Promise<ChannelSendResult>;
}
