export function hasAcceptedCheckoutTerms(value: unknown): boolean {
  return typeof value === "object" && value !== null && "legalAccepted" in value
    && (value as { legalAccepted?: unknown }).legalAccepted === true;
}
