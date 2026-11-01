export type SendRefusalReason =
  | "messaging_disabled"
  | "contact_not_found"
  | "no_inbound_message"
  | "contact_opted_out"
  | "outside_response_window"
  | "rate_limit_exceeded"
  | "duplicate_message"
  | "invalid_message";

export type SendDecision =
  | { allowed: true }
  | { allowed: false; reason: SendRefusalReason };
