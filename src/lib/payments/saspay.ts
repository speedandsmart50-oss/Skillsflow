import { createHmac, timingSafeEqual } from "node:crypto";

const SASPAY_API_URL = process.env.SASPAY_API_URL ?? "https://api.saspay.me/api/v1";

export const paymentSetup = {
  apiKeyConfigured: Boolean(process.env.SASPAY_API_KEY),
  webhookConfigured: Boolean(process.env.SASPAY_WEBHOOK_SECRET),
};

export function isPaymentReady(): boolean {
  return paymentSetup.apiKeyConfigured && paymentSetup.webhookConfigured;
}

export async function saspayRequest(path: string, init: RequestInit = {}) {
  const apiKey = process.env.SASPAY_API_KEY;
  if (!apiKey) throw new Error("SASPAY_API_KEY is not configured");

  const response = await fetch(`${SASPAY_API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const payload = await response.json() as {
    success?: boolean;
    data?: Record<string, unknown>;
    error?: { message?: string } | Record<string, string[]>;
    code?: number;
  };

  if (!response.ok || payload.success === false) {
    const message = typeof payload.error === "object" && "message" in payload.error && typeof payload.error.message === "string"
      ? payload.error.message
      : "SasPay rejected the request";
    throw new Error(message);
  }

  return payload.data ?? {};
}

export function verifySasPayWebhook(rawBody: string, signature: string | null, timestamp: string | null) {
  const secret = process.env.SASPAY_WEBHOOK_SECRET;
  if (!secret || !signature || !timestamp) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 300) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const actual = Buffer.from(signature, "utf8");
  const target = Buffer.from(expected, "utf8");
  return actual.length === target.length && timingSafeEqual(actual, target);
}
