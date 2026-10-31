import "server-only";

import type { User } from "@supabase/supabase-js";

export function isConfiguredAdmin(user: Pick<User, "email">) {
  const configuredEmail = process.env.SKILLFLOW_ADMIN_EMAIL?.trim().toLowerCase();
  return Boolean(configuredEmail && user.email?.trim().toLowerCase() === configuredEmail);
}
