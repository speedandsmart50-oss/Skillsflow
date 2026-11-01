import assert from "node:assert/strict";
import test from "node:test";

import {
  createWhatsAppFollowupWorker,
  type ClaimedWhatsAppFollowup,
} from "../src/lib/messaging/service/followup-worker";

const followup: ClaimedWhatsAppFollowup = {
  id: "followup-id",
  user_id: "user-id",
  contact_id: "contact-id",
  message_content: "Bonjour",
  message_type: "free",
  template_name: null,
  template_language: null,
  approved_by: "user-id",
  claim_token: "claim-token",
};

test("disabled worker does not claim or send follow-ups", async () => {
  let claims = 0;
  const worker = createWhatsAppFollowupWorker({
    messagingEnabled: false,
    claim: async () => {
      claims += 1;
      return [followup];
    },
    send: async () => ({ status: "denied", reason: "messaging_disabled" }),
    complete: async () => true,
  });

  assert.deepEqual(await worker(), {
    claimed: 0,
    sent: 0,
    drafts: 0,
    cancelled: 0,
    failed: 0,
    claimLost: 0,
  });
  assert.equal(claims, 0);
});

test("worker records dry-run draft for explicit human approval", async () => {
  const completed: Array<Record<string, unknown>> = [];
  let sentRequest: unknown;
  const worker = createWhatsAppFollowupWorker({
    messagingEnabled: true,
    claim: async (limit) => {
      assert.equal(limit, 5);
      return [followup];
    },
    send: async (request) => {
      sentRequest = request;
      return { status: "draft", messageId: "draft-id" };
    },
    complete: async (input) => {
      completed.push(input);
      return true;
    },
  });

  const result = await worker();
  assert.equal(result.drafts, 1);
  assert.equal(result.sent, 0);
  assert.equal((sentRequest as { contactId: string }).contactId, followup.contact_id);
  assert.deepEqual(completed, [{
    followupId: followup.id,
    claimToken: followup.claim_token,
    status: "awaiting_approval",
    reason: "dry_run_requires_message_approval",
    resultMessageId: "draft-id",
  }]);
});

test("worker cancels refusals and never retries ambiguous send failures", async () => {
  const statuses: string[] = [];
  const worker = createWhatsAppFollowupWorker({
    messagingEnabled: true,
    claim: async () => [
      followup,
      { ...followup, id: "second-followup", contact_id: "second-contact" },
    ],
    send: async (request) => {
      if (request.contactId === followup.contact_id) {
        return { status: "denied", reason: "consent_required" };
      }
      throw new Error("provider result unknown");
    },
    complete: async (input) => {
      statuses.push(input.status);
      return true;
    },
  });

  const result = await worker();
  assert.deepEqual(statuses, ["cancelled", "failed"]);
  assert.equal(result.cancelled, 1);
  assert.equal(result.failed, 1);
});

test("worker reports lost claim when the atomic completion no longer matches", async () => {
  const worker = createWhatsAppFollowupWorker({
    messagingEnabled: true,
    claim: async () => [followup],
    send: async () => ({
      status: "sent",
      messageId: "message-id",
      externalMessageId: "provider-id",
    }),
    complete: async () => false,
  });

  const result = await worker();
  assert.equal(result.sent, 1);
  assert.equal(result.claimLost, 1);
});
