export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

export function isValidUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function hasDisallowedMessageContent(content: string): boolean {
  const normalized = content.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /\b(gains? garantis?|revenu passif garanti|sans risque|devenir riche|derniere chance|garantis? des gains?)\b/i.test(normalized);
}
