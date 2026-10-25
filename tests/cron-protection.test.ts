import assert from "node:assert/strict";
import test from "node:test";
import { createSasPayReconcileHandler, type CronDatabaseClient } from "../src/lib/payments/reconcile-cron";

function emptySupabase(): CronDatabaseClient {
  type SelectQuery = {
    in: (column: string, values: string[]) => SelectQuery;
    lt: (column: string, value: string) => SelectQuery;
    gt: (column: string, value: string) => SelectQuery;
    not: (column: string, operator: string, value: null) => SelectQuery;
    or: (filters: string) => SelectQuery;
    order: (column: string, options: { ascending: boolean; nullsFirst?: boolean }) => SelectQuery;
    limit: (count: number) => Promise<{ data: []; error: null }>;
  };
  const selectQuery: SelectQuery = {
    in: () => selectQuery,
    lt: () => selectQuery,
    gt: () => selectQuery,
    not: () => selectQuery,
    or: () => selectQuery,
    order: () => selectQuery,
    limit: async () => ({ data: [], error: null }),
  };
  const client = {
    from(table: string) {
      if (table === "orders") return { select: () => selectQuery };
      return {
        delete: () => ({ lt: async () => ({ error: null }) }),
        insert: async () => ({ error: null }),
      };
    },
  };
  return client as unknown as CronDatabaseClient;
}

test("cron rejects a request when CRON_SECRET is absent", async () => {
  const handler = createSasPayReconcileHandler({
    readSecret: () => undefined,
    getSupabase: () => { throw new Error("database must not be accessed"); },
    activate: async () => ({ activated: false, reason: "pending" }),
  });
  const response = await handler(new Request("https://skillflow.test/api/cron/saspay-reconcile"));
  assert.equal(response.status, 401);
});

test("cron rejects a request without the matching Bearer authorization", async () => {
  const handler = createSasPayReconcileHandler({
    readSecret: () => "test-only-secret",
    getSupabase: () => { throw new Error("database must not be accessed"); },
    activate: async () => ({ activated: false, reason: "pending" }),
  });
  const response = await handler(new Request("https://skillflow.test/api/cron/saspay-reconcile", {
    headers: { authorization: "Bearer wrong-secret" },
  }));
  assert.equal(response.status, 401);
});

test("cron returns a zero-payment summary with valid authorization and no pending orders", async () => {
  const handler = createSasPayReconcileHandler({
    readSecret: () => "test-only-secret",
    getSupabase: emptySupabase,
    activate: async () => ({ activated: false, reason: "pending" }),
    now: () => new Date("2026-01-01T00:00:00.000Z"),
  });
  const response = await handler(new Request("https://skillflow.test/api/cron/saspay-reconcile", {
    headers: { authorization: "Bearer test-only-secret" },
  }));
  const body = await response.json() as { checked: number; activated: number; summary: string };
  assert.equal(response.status, 200);
  assert.equal(body.checked, 0);
  assert.equal(body.activated, 0);
  assert.equal(body.summary, "0 commande(s) vérifiée(s), 0 paiement(s) activé(s).");
});
