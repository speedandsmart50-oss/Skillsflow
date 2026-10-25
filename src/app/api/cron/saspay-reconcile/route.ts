import { createSasPayReconcileHandler, type CronDatabaseClient } from "@/lib/payments/reconcile-cron";
import { activateSubscription } from "@/lib/payments/activation";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export const GET = createSasPayReconcileHandler({
  readSecret: () => process.env.CRON_SECRET,
  getSupabase: () => getSupabaseAdminClient() as unknown as CronDatabaseClient,
  activate: async (orderId, source) => await activateSubscription(orderId, source),
});
