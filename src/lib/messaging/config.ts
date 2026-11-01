export function isMessagingEnabled() {
  return process.env.MESSAGING_ENABLED === "true";
}

export function isGrowthEnabled() {
  return process.env.GROWTH_ENABLED === "true";
}

export function isMessagingDryRun() {
  return process.env.DRY_RUN !== "false";
}

export function isWhatsAppLiveSendEnabled() {
  return process.env.WHATSAPP_LIVE_SENDS_ENABLED === "true";
}

function readLimit(name: string, defaultValue: number, maximum: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultValue;

  if (!/^[1-9]\d*$/.test(raw)) {
    throw new Error(`Invalid ${name} messaging configuration.`);
  }

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > maximum) {
    throw new Error(`Invalid ${name} messaging configuration.`);
  }
  return value;
}

export function getMessagingSendLimits() {
  return {
    maxContactPerDay: readLimit("MAX_OUTBOUND_PER_CONTACT_PER_DAY", 3, 100),
    maxOutboundPerHour: readLimit("MAX_OUTBOUND_PER_HOUR", 50, 10_000),
  };
}
