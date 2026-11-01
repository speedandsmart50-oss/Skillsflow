import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { isConfiguredMessagingAdmin } from "../src/lib/messaging/mcp-tools/access-policy";

const registerUrl = new URL(
  "../src/lib/messaging/mcp-tools/register.ts",
  import.meta.url,
);
const routeUrl = new URL("../src/app/api/mcp/route.ts", import.meta.url);

test("messaging MCP access requires the configured admin profile", () => {
  assert.equal(isConfiguredMessagingAdmin(
    "admin",
    " OWNER@example.com ",
    "owner@example.com",
  ), true);
  assert.equal(isConfiguredMessagingAdmin("member", "owner@example.com", "owner@example.com"), false);
  assert.equal(isConfiguredMessagingAdmin("admin", "other@example.com", "owner@example.com"), false);
  assert.equal(isConfiguredMessagingAdmin("admin", "owner@example.com", undefined), false);
  assert.equal(isConfiguredMessagingAdmin("admin", null, "owner@example.com"), false);
});

test("MCP registration only exposes stored-contact WhatsApp operations", async () => {
  const [register, route] = await Promise.all([
    readFile(registerUrl, "utf8"),
    readFile(routeUrl, "utf8"),
  ]);

  assert.match(route, /if \(isMessagingEnabled\(\)\)\s*\{\s*registerMessagingTools\(server, caller\);/);
  assert.match(register, /if \(!caller\) return server/);
  assert.match(register, /list_whatsapp_contacts/);
  assert.match(register, /get_whatsapp_conversation/);
  assert.match(register, /send_whatsapp_message/);
  assert.match(register, /create_whatsapp_followup_draft/);
  assert.match(register, /list_whatsapp_followups/);
  assert.match(register, /approve_whatsapp_followup/);
  assert.match(register, /cancel_whatsapp_followup/);
  assert.match(register, /approve_and_send_whatsapp_followup_draft/);
  assert.match(register, /idempotency_key: z\.string\(\)\.uuid\(\)/);
  assert.match(register, /channel: z\.enum\(\["whatsapp", "messenger", "instagram"\]\)\.optional\(\)/);
  assert.match(register, /z\.string\(\)\.uuid\(\)/);
  assert.match(register, /contact_id: z\.string\(\)\.uuid\(\)/);
  assert.match(register, /actorUserId: userId/);
  assert.match(register, /ownerUserId: userId/);
  assert.match(register, /sendMessagingMessage\(request\)/);
  assert.match(register, /text_chars: text\.length/);
  assert.doesNotMatch(register, /input_summary:\s*\{[^}]*text\s*[,}]/);
  assert.doesNotMatch(register, /recipient_phone|phone_number:\s*z\./i);
});
