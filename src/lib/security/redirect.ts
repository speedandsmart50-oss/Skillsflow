export function safeNextPath(value: string | null, fallback = "/account"): string {
  if (!value) return fallback;

  try {
    const target = new URL(value, "https://skillflow.invalid");
    if (target.origin !== "https://skillflow.invalid") return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}
