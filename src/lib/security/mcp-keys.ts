import { createHash, randomBytes } from "node:crypto";

export function hashMcpKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function parseMcpBearerToken(header: string | null) {
  return header?.match(/^Bearer\s+(sf_[A-Za-z0-9_-]{43})$/i)?.[1] ?? null;
}

export function createMcpKey() {
  const value = `sf_${randomBytes(32).toString("base64url")}`;
  return { value, hash: hashMcpKey(value) };
}
