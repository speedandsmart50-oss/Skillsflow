import { createHmac, timingSafeEqual } from "node:crypto";

function constantTimeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyMetaWebhookToken(candidate: string, expected: string): boolean {
  return Boolean(candidate && expected && constantTimeStringEqual(candidate, expected));
}

export function verifyMetaWebhookSignature(
  rawBody: Uint8Array,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  const signature = signatureHeader?.match(/^sha256=([a-f\d]{64})$/i)?.[1];
  if (!signature || !appSecret) return false;

  const received = Buffer.from(signature, "hex");
  const expected = createHmacDigest(rawBody, appSecret);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function createHmacDigest(rawBody: Uint8Array, appSecret: string): Buffer {
  return createHmac("sha256", appSecret).update(rawBody).digest();
}
