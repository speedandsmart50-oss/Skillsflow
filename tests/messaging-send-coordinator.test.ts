import assert from "node:assert/strict";
import test from "node:test";

import { createMessagingSendCoordinator } from "../src/lib/messaging/service/send-coordinator";
import type { SendMessageRequest } from "../src/lib/messaging/rules/types";

const request: SendMessageRequest = {
  ownerUserId: "owner-id",
  actorUserId: "admin-id",
  contactId: "contact-id",
  channel: "whatsapp",
  message: { type: "free", content: "Hello" },
};

test("denied send decisions never invoke the adapter", async () => {
  let sendCalls = 0;
  const send = createMessagingSendCoordinator({
    authorize: async () => ({
      allowed: false,
      reason: "consent_required",
      dryRun: true,
    }),
    send: async () => {
      sendCalls += 1;
      return { externalMessageId: "unexpected" };
    },
  });

  assert.deepEqual(await send(request), {
    status: "denied",
    reason: "consent_required",
    dryRun: true,
  });
  assert.equal(sendCalls, 0);
});

test("dry-run decisions return the persisted draft without invoking the adapter", async () => {
  let sendCalls = 0;
  const send = createMessagingSendCoordinator({
    authorize: async () => ({
      allowed: true,
      messageId: "draft-id",
      dryRun: true,
    }),
    send: async () => {
      sendCalls += 1;
      return { externalMessageId: "unexpected" };
    },
  });

  assert.deepEqual(await send(request), {
    status: "draft",
    messageId: "draft-id",
    dryRun: true,
  });
  assert.equal(sendCalls, 0);
});

test("approved live sends invoke the adapter only after authorization", async () => {
  const events: string[] = [];
  const send = createMessagingSendCoordinator({
    authorize: async () => {
      events.push("authorized");
      return { allowed: true, messageId: "message-id", dryRun: false };
    },
    send: async (_request, messageId) => {
      events.push(`send:${messageId}`);
      return { externalMessageId: "wamid.sent" };
    },
  });

  assert.deepEqual(await send(request), {
    status: "sent",
    messageId: "message-id",
    externalMessageId: "wamid.sent",
    dryRun: false,
  });
  assert.deepEqual(events, ["authorized", "send:message-id"]);
});
