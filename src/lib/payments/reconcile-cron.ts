export type CronOrder = {
  id: string;
  order_reference: string;
  last_reconciled_at: string | null;
};

type DatabaseError = { message?: string } | null;
type DeleteQuery = { lt(column: string, value: string): Promise<{ error: DatabaseError }> };
type RowsQuery = {
  in(column: string, values: string[]): RowsQuery;
  lt(column: string, value: string): RowsQuery;
  gt(column: string, value: string): RowsQuery;
  not(column: string, operator: string, value: null): RowsQuery;
  or(filters: string): RowsQuery;
  order(column: string, options: { ascending: boolean; nullsFirst?: boolean }): RowsQuery;
  limit(count: number): Promise<{ data: CronOrder[] | null; error: DatabaseError }>;
};

export type CronDatabaseClient = {
  from(table: string): {
    delete(): DeleteQuery;
    select(columns: string): RowsQuery;
    insert(values: Record<string, unknown>): Promise<{ error: DatabaseError }>;
    update(values: Record<string, unknown>): {
      eq(column: string, value: string): {
        in(column: string, values: string[]): Promise<{ error: DatabaseError }>;
      };
    };
  };
};

export type ActivationResult =
  | { activated: true; alreadyPaid?: boolean }
  | { activated: false; reason: string };

type HandlerDependencies = {
  readSecret: () => string | undefined;
  getSupabase: () => CronDatabaseClient;
  activate: (orderId: string, source: "cron") => Promise<ActivationResult>;
  now?: () => Date;
};

export function createSasPayReconcileHandler(dependencies: HandlerDependencies) {
  return async function GET(request: Request): Promise<Response> {
    const secret = dependencies.readSecret();
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
      return Response.json({ error: "Accès refusé." }, { status: 401 });
    }

    const now = dependencies.now ?? (() => new Date());
    const supabase = dependencies.getSupabase();
    const retentionCutoff = new Date(now().getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { error: webhookCleanupError } = await supabase.from("saspay_webhook_logs")
      .delete().lt("received_at", retentionCutoff);
    const { error: reconciliationCleanupError } = await supabase.from("payment_reconciliation_logs")
      .delete().lt("created_at", retentionCutoff);
    if (webhookCleanupError || reconciliationCleanupError) {
      console.error("Could not prune old payment audit logs:", webhookCleanupError?.message ?? reconciliationCleanupError?.message);
    }
    const before = new Date(now().getTime() - 2 * 60 * 1000).toISOString();
    const after = new Date(now().getTime() - 48 * 60 * 60 * 1000).toISOString();
    const retryAfter = new Date(now().getTime() - 4 * 60 * 1000).toISOString();
    const { data: orders, error } = await supabase.from("orders")
      .select("id, order_reference, last_reconciled_at")
      .in("payment_status", ["pending", "failed", "expired"])
      .lt("created_at", before)
      .gt("created_at", after)
      .not("provider_checkout_id", "is", null)
      .or(`last_reconciled_at.is.null,last_reconciled_at.lt.${retryAfter}`)
      .order("last_reconciled_at", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) {
      console.error("Could not load pending SasPay orders for reconciliation:", error.message);
      return Response.json({ error: "Impossible de charger les commandes en attente." }, { status: 500 });
    }

    const counts = { checked: 0, activated: 0, pending: 0, expired: 0, failed: 0, errors: 0 };
    for (const order of orders ?? []) {
      counts.checked += 1;
      let action = "pending";
      let detail: string | null = null;
      try {
        const result = await dependencies.activate(order.id, "cron");
        if (result.activated) {
          counts.activated += result.alreadyPaid ? 0 : 1;
          action = result.alreadyPaid ? "already_paid" : "activated";
        } else {
          action = result.reason;
          detail = result.reason;
          if (result.reason === "pending") counts.pending += 1;
          else if (result.reason === "expired") counts.expired += 1;
          else if (result.reason === "failed") counts.failed += 1;
          else counts.errors += 1;
        }
      } catch (caught) {
        action = "error";
        detail = caught instanceof Error ? caught.message.slice(0, 500) : "Unknown reconciliation error";
        counts.errors += 1;
        console.error(`SasPay reconciliation failed for ${order.order_reference}:`, detail);
      }
      const { error: logError } = await supabase.from("payment_reconciliation_logs").insert({
        order_id: order.id,
        order_reference: order.order_reference,
        source: "cron",
        action,
        detail,
      });
      if (logError) console.error("Could not record reconciliation action:", logError.message);
      const { error: attemptError } = await supabase.from("orders")
        .update({ last_reconciled_at: now().toISOString() })
        .eq("id", order.id)
        .in("payment_status", ["pending", "failed", "expired"]);
      if (attemptError) console.error("Could not record reconciliation attempt:", attemptError.message);
    }

    return Response.json({
      ...counts,
      summary: `${counts.checked} commande(s) vérifiée(s), ${counts.activated} paiement(s) activé(s).`,
      runAt: now().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  };
}
