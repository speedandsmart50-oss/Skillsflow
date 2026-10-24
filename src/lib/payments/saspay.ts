import { createHmac, timingSafeEqual } from "node:crypto";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isSasPayLiveReady(): boolean {
  return Boolean(
    process.env.SASPAY_API_KEY?.startsWith("sk_live_")
      && process.env.SASPAY_WEBHOOK_SECRET
      && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export async function saspayRequest(path: string, init: RequestInit = {}) {
  const apiKey = process.env.SASPAY_API_KEY;
  if (!apiKey) throw new Error("SASPAY_API_KEY is not configured");
  if (!apiKey.startsWith("sk_live_")) {
    throw new Error("A SasPay live key beginning with sk_live_ is required.");
  }

  const apiUrl = process.env.SASPAY_API_URL ?? "https://api.saspay.me/api/v1";
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const responseText = await response.text();
  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(responseText);
  } catch {
    throw new Error(`SasPay returned an invalid response (${response.status}).`);
  }
  if (!isRecord(parsedPayload)) {
    throw new Error(`SasPay returned an invalid response (${response.status}).`);
  }

  const payload = parsedPayload as {
    success?: boolean;
    data?: Record<string, unknown>;
    error?: { message?: string } | Record<string, string[]>;
    code?: number;
  };

  if (!response.ok || payload.success === false) {
    const message = payload.error !== null
      && typeof payload.error === "object"
      && "message" in payload.error
      && typeof payload.error.message === "string"
      ? payload.error.message
      : "SasPay rejected the request";
    throw new Error(message);
  }

  return payload.data ?? {};
}

export function verifySasPayWebhook(rawBody: string, signature: string | null, timestamp: string | null) {
  const secret = process.env.SASPAY_WEBHOOK_SECRET;
  if (!secret || !signature || !timestamp || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 300) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const actual = Buffer.from(signature, "utf8");
  const target = Buffer.from(expected, "utf8");
  return actual.length === target.length && timingSafeEqual(actual, target);
}
