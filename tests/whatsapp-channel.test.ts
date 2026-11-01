import assert from "node:assert/strict";
import test from "node:test";

import {
  createWhatsAppChannelAdapter,
  WhatsAppChannelError,
} from "../src/lib/messaging/channels/whatsapp";

const contact = {
  id: "contact-id",
  channel: "whatsapp" as const,
  externalId: "15551234567",
};

function createAdapter(
  fetcher: typeof fetch,
  sleep: (milliseconds: number) => Promise<void> = async () => {},
) {
  return createWhatsAppChannelAdapter({
    accessToken: "test-access-token",
    apiVersion: "v99.0",
    phoneNumberId: "123456789",
    fetcher,
    sleep,
  });
}

test("WhatsApp text send uses the configured Graph version and scoped sender", async () => {
  let url = "";
  let authorization = "";
  let body: Record<string, unknown> | undefined;
  const adapter = createAdapter(async (input, init) => {
    url = String(input);
    authorization = new Headers(init?.headers).get("authorization") ?? "";
    body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json({ messages: [{ id: "wamid.outbound" }] });
  });

  const result = await adapter.sendText(contact, "Hello");
  assert.equal(url, "https://graph.facebook.com/v99.0/123456789/messages");
  assert.equal(authorization, "Bearer test-access-token");
  assert.deepEqual(body, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: "15551234567",
    type: "text",
    text: { preview_url: false, body: "Hello" },
  });
  assert.deepEqual(result, { externalMessageId: "wamid.outbound" });
});

test("WhatsApp template send contains only its approved template identity", async () => {
  let body: Record<string, unknown> | undefined;
  const adapter = createAdapter(async (_input, init) => {
    body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json({ messages: [{ id: "wamid.template" }] });
  });

  await adapter.sendTemplate(contact, { name: "welcome_back", language: "en_US" });
  assert.deepEqual(body, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: "15551234567",
    type: "template",
    template: {
      name: "welcome_back",
      language: { code: "en_US" },
    },
  });
});

test("WhatsApp retries explicit 429 responses only within the bounded budget", async () => {
  let calls = 0;
  const delays: number[] = [];
  const adapter = createAdapter(async () => {
    calls += 1;
    if (calls < 3) {
      return new Response(null, { status: 429 });
    }
    return Response.json({ messages: [{ id: "wamid.retry" }] });
  }, async (milliseconds) => {
    delays.push(milliseconds);
  });

  const result = await adapter.sendText(contact, "Retry safely");
  assert.equal(result.externalMessageId, "wamid.retry");
  assert.equal(calls, 3);
  assert.deepEqual(delays, [250, 500]);
});

test("WhatsApp does not retry ambiguous server or network failures", async () => {
  let serverCalls = 0;
  const serverErrorAdapter = createAdapter(async () => {
    serverCalls += 1;
    return new Response(null, { status: 503 });
  });
  await assert.rejects(
    serverErrorAdapter.sendText(contact, "Hello"),
    (error: unknown) => error instanceof WhatsAppChannelError
      && error.code === "whatsapp_http_503",
  );
  assert.equal(serverCalls, 1);

  let networkCalls = 0;
  const networkErrorAdapter = createAdapter(async () => {
    networkCalls += 1;
    throw new Error("transport failed");
  });
  await assert.rejects(
    networkErrorAdapter.sendText(contact, "Hello"),
    (error: unknown) => error instanceof WhatsAppChannelError
      && error.code === "whatsapp_network_error",
  );
  assert.equal(networkCalls, 1);
});

test("WhatsApp rejects unsafe configuration, recipient IDs, and payloads", async () => {
  assert.throws(
    () => createWhatsAppChannelAdapter({
      accessToken: "token",
      apiVersion: "latest",
      phoneNumberId: "123456789",
    }),
    (error: unknown) => error instanceof WhatsAppChannelError
      && error.code === "whatsapp_api_version_invalid",
  );

  let calls = 0;
  const adapter = createAdapter(async () => {
    calls += 1;
    return Response.json({ messages: [{ id: "unexpected" }] });
  });
  await assert.rejects(
    adapter.sendText({ ...contact, externalId: "recipient@example.test" }, "Hello"),
    (error: unknown) => error instanceof WhatsAppChannelError
      && error.code === "whatsapp_recipient_invalid",
  );
  await assert.rejects(
    adapter.sendText(contact, "x".repeat(4097)),
    (error: unknown) => error instanceof WhatsAppChannelError
      && error.code === "whatsapp_text_invalid",
  );
  assert.equal(calls, 0);
});
