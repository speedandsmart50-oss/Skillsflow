import { createHash } from "node:crypto";
import { after } from "next/server";
import { isMessagingEnabled } from "@/lib/messaging/config";
import {
  verifyMetaWebhookSignature,
  verifyMetaWebhookToken,
} from "@/lib/messaging/webhooks/meta-signature";
import {
  parseWhatsAppWebhookPayload,
  WhatsAppWebhookPayloadError,
} from "@/lib/messaging/webhooks/whatsapp-parser";
import {
  enqueueWhatsAppWebhook,
  processWhatsAppWebhookQueueEvent,
} from "@/lib/messaging/webhooks/whatsapp-queue";

export const maxDuration = 60;

const MAX_WEBHOOK_BODY_BYTES = 1_048_576;
const RESPONSE_HEADERS = { "cache-control": "no-store" };

function disabledResponse(): Response {
  return new Response(null, { status: 404, headers: RESPONSE_HEADERS });
}

async function readBoundedBody(request: Request): Promise<Uint8Array | null> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength)
    && Number(contentLength) > MAX_WEBHOOK_BODY_BYTES) {
    return null;
  }
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalLength += value.byteLength;
    if (totalLength > MAX_WEBHOOK_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function GET(request: Request): Promise<Response> {
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

export async function POST(request: Request): Promise<Response> {
  if (!isMessagingEnabled()) return disabledResponse();

  const appSecret = process.env.META_APP_SECRET;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!appSecret || !phoneNumberId) {
    return new Response(null, { status: 503, headers: RESPONSE_HEADERS });
  }

  const rawBody = await readBoundedBody(request);
  if (!rawBody) return new Response(null, { status: 413, headers: RESPONSE_HEADERS });
  if (!verifyMetaWebhookSignature(rawBody, request.headers.get("x-hub-signature-256"), appSecret)) {
    return new Response(null, { status: 401, headers: RESPONSE_HEADERS });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(rawBody));
  } catch {
    return new Response(null, { status: 400, headers: RESPONSE_HEADERS });
  }

  let events;
  try {
    events = parseWhatsAppWebhookPayload(payload, phoneNumberId);
  } catch (error) {
    if (error instanceof WhatsAppWebhookPayloadError) {
      return new Response(null, {
        status: error.code === "phone_number_mismatch" ? 403 : 400,
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
    queuedEvent = await enqueueWhatsAppWebhook(eventHash, events);
  } catch (error) {
    console.error("Could not enqueue WhatsApp webhook event", {
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return new Response(null, { status: 503, headers: RESPONSE_HEADERS });
  }

  if (queuedEvent.shouldProcess) {
    try {
      after(() => processWhatsAppWebhookQueueEvent(queuedEvent.id));
    } catch (error) {
      console.error("Could not schedule WhatsApp webhook processing", {
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
