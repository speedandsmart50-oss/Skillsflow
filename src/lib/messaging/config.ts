export function isMessagingEnabled() {
  return process.env.MESSAGING_ENABLED === "true";
}

export function isMessagingDryRun() {
  return process.env.DRY_RUN !== "false";
}
