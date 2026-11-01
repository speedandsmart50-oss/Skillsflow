import { createHash } from "node:crypto";
import { after } from "next/server";
import { isMessagingEnabled } from "../config";
import { readBoundedMetaWebhookBody } from "./http";
import {
  verifyMetaWebhookSignature,
  verifyMetaWebhookToken,
} from "./meta-signature";
import { PageMessagingWebhookPayloadError } from "./page-messaging-parser";
import type { NormalizedInboundMessage } from "./types";

interface PageWebhookHandlersConfig {
  channel: "messenger" | "instagram";
  accountIdEnvironmentVariable: "MESSENGER_PAGE_ID" | "INSTAGRAM_ACCOUNT_ID";
  parsePayload(payload: unknown, accountId: string): NormalizedInboundMessage[];
  enqueue(eventHash: string, events: NormalizedInboundMessage[]): Promise<{
    id: string;
    shouldProcess: boolean;
  }>;
  process(eventId: string): Promise<void>;
}

const RESPONSE_HEADERS = { "cache-control": "no-store" };

function disabledResponse(): Response {
  return new Response(null, { status: 404, headers: RESPONSE_HEADERS });
}

export function createPageWebhookHandlers(config: PageWebhookHandlersConfig) {
  async function GET(request: Request): Promise<Response> {
    if (!isMessagingEnabled()) return disabledResponse();

    const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
    if (!expectedToken) return new Response(null, { status: 503, headers: RESPONSE_HEADERS });

    const params = new URL(request.url).searchParams;
    const mode = params.get("hub.mode");
    const token = params.get("hub.verify_token");
    const challenge = params.get("hub.challenge");
    if (mode !== "subscribe" || !token || !challenge || challenge.length > 256) {
      return new Response(null, { status: 400, headers: RESPONSE_HEADERS });
    }
    if (!verifyMetaWebhookToken(token, expectedToken)) {
      return new Response(null, { status: 403, headers: RESPONSE_HEADERS });
    }
    return new Response(challenge, {
      status: 200,
      headers: { ...RESPONSE_HEADERS, "content-type": "text/plain; charset=utf-8" },
    });
  }

  async function POST(request: Request): Promise<Response> {
    if (!isMessagingEnabled()) return disabledResponse();

    const appSecret = process.env.META_APP_SECRET;
    const accountId = process.env[config.accountIdEnvironmentVariable];
    if (!appSecret || !accountId) {
      return new Response(null, { status: 503, headers: RESPONSE_HEADERS });
    }

    const rawBody = await readBoundedMetaWebhookBody(request);
    if (!rawBody) return new Response(null, { status: 413, headers: RESPONSE_HEADERS });
    if (!verifyMetaWebhookSignature(
      rawBody,
      request.headers.get("x-hub-signature-256"),
      appSecret,
    )) {
      return new Response(null, { status: 401, headers: RESPONSE_HEADERS });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(rawBody));
    } catch {
      return new Response(null, { status: 400, headers: RESPONSE_HEADERS });
    }

    let events: NormalizedInboundMessage[];
    try {
      events = config.parsePayload(payload, accountId);
    } catch (error) {
      if (error instanceof PageMessagingWebhookPayloadError) {
        return new Response(null, {
          status: error.code === "account_mismatch" ? 403 : 400,
          headers: RESPONSE_HEADERS,
        });
      }
      throw error;
    }

    if (events.length === 0) {
      return new Response("EVENT_RECEIVED", {
        status: 200,
        headers: { ...RESPONSE_HEADERS, "content-type": "text/plain; charset=utf-8" },
      });
    }

    const eventHash = createHash("sha256").update(rawBody).digest("hex");
    let queuedEvent: { id: string; shouldProcess: boolean };
    try {
      queuedEvent = await config.enqueue(eventHash, events);
    } catch (error) {
      console.error(`Could not enqueue ${config.channel} webhook event`, {
        error: error instanceof Error ? error.name : "UnknownError",
      });
      return new Response(null, { status: 503, headers: RESPONSE_HEADERS });
    }

    if (queuedEvent.shouldProcess) {
      try {
        after(async () => config.process(queuedEvent.id));
      } catch (error) {
        console.error(`Could not schedule ${config.channel} webhook processing`, {
          eventId: queuedEvent.id,
          error: error instanceof Error ? error.name : "UnknownError",
        });
        return new Response(null, { status: 503, headers: RESPONSE_HEADERS });
      }
    }

    return new Response("EVENT_RECEIVED", {
      status: 200,
      headers: { ...RESPONSE_HEADERS, "content-type": "text/plain; charset=utf-8" },
    });
  }

  return { GET, POST };
}
