import type {
  ApprovedMessageTemplate,
  ChannelSendResult,
  MessagingChannelAdapter,
  MessagingContactReference,
} from "./types";

const MAX_ATTEMPTS = 3;
const MAX_RETRY_AFTER_MS = 2_000;
const REQUEST_TIMEOUT_MS = 10_000;

interface WhatsAppAdapterOptions {
  accessToken: string;
  apiVersion: string;
  phoneNumberId: string;
  fetcher?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
}

interface WhatsAppApiResponse {
  messages?: Array<{ id?: unknown }>;
}

export class WhatsAppChannelError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(code);
    this.name = "WhatsAppChannelError";
  }
}

function isApiResponse(value: unknown): value is WhatsAppApiResponse {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function retryDelay(response: Response, attempt: number): number | null {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter === null) return Math.min(250 * 2 ** (attempt - 1), MAX_RETRY_AFTER_MS);

  const seconds = Number(retryAfter);
  const delay = Number.isFinite(seconds)
    ? seconds * 1000
    : Date.parse(retryAfter) - Date.now();
  if (!Number.isFinite(delay) || delay < 0 || delay > MAX_RETRY_AFTER_MS) return null;
  return delay;
}

export function createWhatsAppChannelAdapter(
  options: WhatsAppAdapterOptions,
): MessagingChannelAdapter<"whatsapp"> {
  const accessToken = options.accessToken.trim();
  const apiVersion = options.apiVersion.trim();
  const phoneNumberId = options.phoneNumberId.trim();
  if (!accessToken) throw new WhatsAppChannelError("whatsapp_token_missing", false);
  if (!/^v\d+\.\d+$/.test(apiVersion)) {
    throw new WhatsAppChannelError("whatsapp_api_version_invalid", false);
  }
  if (!/^[A-Za-z0-9]+$/.test(phoneNumberId)) {
    throw new WhatsAppChannelError("whatsapp_phone_number_id_invalid", false);
  }

  const fetcher = options.fetcher ?? fetch;
  const sleep = options.sleep ?? ((milliseconds: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const endpoint = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  async function submit(
    contact: MessagingContactReference<"whatsapp">,
    payload: Record<string, unknown>,
  ): Promise<ChannelSendResult> {
    if (!/^\d{3,20}$/.test(contact.externalId)) {
      throw new WhatsAppChannelError("whatsapp_recipient_invalid", false);
    }

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      let response: Response;
      try {
        response = await fetcher(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          cache: "no-store",
        });
      } catch {
        throw new WhatsAppChannelError("whatsapp_network_error", false);
      }

      if (response.status === 429) {
        const delay = attempt < MAX_ATTEMPTS ? retryDelay(response, attempt) : null;
        if (delay !== null) {
          await sleep(delay);
          continue;
        }
        throw new WhatsAppChannelError("whatsapp_rate_limited", false);
      }
      if (!response.ok) {
        throw new WhatsAppChannelError(`whatsapp_http_${response.status}`, false);
      }

      let result: unknown;
      try {
        result = await response.json();
      } catch {
        throw new WhatsAppChannelError("whatsapp_invalid_response", false);
      }
      if (!isApiResponse(result) || !Array.isArray(result.messages)
        || result.messages.length !== 1
        || typeof result.messages[0]?.id !== "string"
        || result.messages[0].id.length === 0
        || result.messages[0].id.length > 255) {
        throw new WhatsAppChannelError("whatsapp_invalid_response", false);
      }
      return { externalMessageId: result.messages[0].id };
    }

    throw new WhatsAppChannelError("whatsapp_rate_limited", false);
  }

  return {
    channel: "whatsapp",
    async sendText(contact, text) {
      if (typeof text !== "string" || text.trim().length === 0 || text.length > 4096) {
        throw new WhatsAppChannelError("whatsapp_text_invalid", false);
      }
      return submit(contact, {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: contact.externalId,
        type: "text",
        text: { preview_url: false, body: text },
      });
    },
    async sendTemplate(contact, template: ApprovedMessageTemplate) {
      if (!/^[a-z0-9_]{1,512}$/.test(template.name)
        || !/^[a-zA-Z0-9_-]{1,32}$/.test(template.language)) {
        throw new WhatsAppChannelError("whatsapp_template_invalid", false);
      }
      return submit(contact, {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: contact.externalId,
        type: "template",
        template: {
          name: template.name,
          language: { code: template.language },
        },
      });
    },
  };
}
