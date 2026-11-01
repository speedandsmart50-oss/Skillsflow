import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { isGrowthEnabled } from "../config";
import { isConfiguredMessagingAdmin } from "./access-policy";
import type { MessagingMcpCaller } from "./register";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mcpResult(value: JsonRecord) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    structuredContent: value,
  };
}

function mcpError(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

export function registerGrowthTools(
  server: McpServer,
  caller: MessagingMcpCaller,
): McpServer {
  if (!caller || !isGrowthEnabled()) return server;

  const withGrowthAdmin = async <T>(
    toolName: string,
    inputSummary: JsonRecord,
    outputSummary: (result: T) => JsonRecord,
    operation: (userId: string) => Promise<T>,
  ) => {
    const supabase = getSupabaseAdminClient();
    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id,email,role")
        .eq("id", caller.userId)
        .maybeSingle();
      if (profileError) throw new Error("admin_check_failed");
      if (!profile || !isConfiguredMessagingAdmin(
        profile.role,
        profile.email,
        process.env.SKILLFLOW_ADMIN_EMAIL,
      )) {
        const { error: logError } = await supabase.from("mcp_tool_usage").insert({
          user_id: caller.userId,
          skill_id: null,
          tool_name: toolName,
          input_summary: inputSummary,
          output_summary: { error: "admin_required" },
          status: "failed",
        });
        if (logError) {
          console.error("Could not log denied growth MCP usage", {
            toolName,
            code: logError.code,
          });
        }
        return mcpError("Ces outils de croissance sont réservés à l’administrateur configuré.");
      }

      const result = await operation(profile.id);
      const { error: logError } = await supabase.from("mcp_tool_usage").insert({
        user_id: profile.id,
        skill_id: null,
        tool_name: toolName,
        input_summary: inputSummary,
        output_summary: outputSummary(result),
        status: "success",
      });
      if (logError) {
        console.error("Could not log growth MCP usage", {
          toolName,
          code: logError.code,
        });
      }
      return mcpResult(isRecord(result) ? result : { result });
    } catch (error) {
      const errorCode = error instanceof Error ? error.message : "unknown_error";
      console.error(`Growth MCP tool ${toolName} failed`, { code: errorCode });
      const { error: logError } = await supabase.from("mcp_tool_usage").insert({
        user_id: caller.userId,
        skill_id: null,
        tool_name: toolName,
        input_summary: inputSummary,
        output_summary: { error: "unavailable" },
        status: "failed",
      });
      if (logError) {
        console.error("Could not log failed growth MCP usage", {
          toolName,
          code: logError.code,
        });
      }
      return mcpError("Cette action de croissance est temporairement indisponible.");
    }
  };

  server.registerTool(
    "get_growth_metrics",
    {
      title: "Consulter les indicateurs internes",
      description:
        "Retourne des volumes agrégés de contacts, messages, suivis et rappels. Aucun contenu de conversation ou destinataire n’est exposé.",
      inputSchema: {
        since: z.string().datetime().optional(),
      },
    },
    async ({ since }) => {
      const sinceDate = since
        ? new Date(since)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      if (sinceDate.getTime() < Date.now() - 365 * 24 * 60 * 60 * 1000) {
        return mcpError("La période des indicateurs ne peut pas dépasser 365 jours.");
      }
      return withGrowthAdmin(
        "get_growth_metrics",
        { since: sinceDate.toISOString() },
        (result: JsonRecord) => ({ keys: Object.keys(result) }),
        async (userId) => {
          const { data, error } = await getSupabaseAdminClient().rpc(
            "get_growth_metrics",
            {
              p_user_id: userId,
              p_since: sinceDate.toISOString(),
              p_growth_enabled: isGrowthEnabled(),
            },
          );
          if (error) throw new Error("growth_metrics_failed");
          if (!isRecord(data)) throw new Error("invalid_growth_metrics_response");
          return data;
        },
      );
    },
  );

  server.registerTool(
    "create_growth_reminder_draft",
    {
      title: "Créer un rappel interne",
      description:
        "Crée un rappel interne à l’état brouillon. Il ne planifie aucun message, ne contacte aucun tiers et ne publie aucun contenu.",
      inputSchema: {
        contact_id: z.string().uuid().optional(),
        title: z.string().trim().min(1).max(140),
        details: z.string().max(1000).optional(),
        due_at: z.string().datetime(),
        idempotency_key: z.string().uuid(),
      },
    },
    async ({ contact_id, title, details, due_at, idempotency_key }) =>
      withGrowthAdmin(
        "create_growth_reminder_draft",
        {
          contact_id: contact_id ?? null,
          title_chars: title.length,
          details_chars: details?.length ?? 0,
          due_at,
          idempotency_key,
        },
        (result: JsonRecord) => ({
          reminder_id: result.reminder_id,
          status: result.status,
          created_at: result.created_at,
        }),
        async (userId) => {
          const { data, error } = await getSupabaseAdminClient().rpc(
            "create_growth_reminder_draft",
            {
              p_user_id: userId,
              p_actor_user_id: userId,
              p_contact_id: contact_id ?? null,
              p_title: title,
              p_details: details ?? "",
              p_due_at: due_at,
              p_idempotency_key: idempotency_key,
              p_growth_enabled: isGrowthEnabled(),
            },
          );
          if (error) throw new Error("growth_reminder_create_failed");
          if (!Array.isArray(data) || data.length !== 1 || !isRecord(data[0])) {
            throw new Error("invalid_growth_reminder_response");
          }
          return {
            reminder_id: data[0].reminder_id,
            status: data[0].status,
            created_at: data[0].created_at,
          };
        },
      ),
  );

  server.registerTool(
    "list_growth_reminder_drafts",
    {
      title: "Lister les rappels internes",
      description: "Liste les rappels internes de l’administrateur sans déclencher d’action externe.",
      inputSchema: {
        status: z.enum(["draft", "completed", "cancelled"]).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      },
    },
    async ({ status, limit }) => withGrowthAdmin(
      "list_growth_reminder_drafts",
      { status: status ?? null, limit: limit ?? 25 },
      (result: { reminders: unknown[] }) => ({ count: result.reminders.length }),
      async (userId) => {
        let query = getSupabaseAdminClient()
          .from("growth_reminders")
          .select("id,contact_id,title,details,due_at,status,completed_at,created_at,updated_at")
          .eq("user_id", userId);
        if (status) query = query.eq("status", status);
        const { data, error } = await query
          .order("due_at", { ascending: true })
          .limit(limit ?? 25);
        if (error) throw new Error("growth_reminder_list_failed");
        return { reminders: data ?? [] };
      },
    ),
  );

  const updateReminder = (
    toolName: "complete_growth_reminder_draft" | "cancel_growth_reminder_draft",
    action: "complete" | "cancel",
  ) => server.registerTool(
    toolName,
    {
      title: action === "complete" ? "Terminer un rappel interne" : "Annuler un rappel interne",
      description: action === "complete"
        ? "Marque un rappel brouillon comme terminé, sans envoyer de message."
        : "Annule un rappel brouillon, sans contacter de tiers.",
      inputSchema: { reminder_id: z.string().uuid() },
    },
    async ({ reminder_id }) => withGrowthAdmin(
      toolName,
      { reminder_id },
      (updated: boolean) => ({ updated }),
      async (userId) => {
        const { data, error } = await getSupabaseAdminClient().rpc(
          "update_growth_reminder_draft",
          {
            p_user_id: userId,
            p_actor_user_id: userId,
            p_reminder_id: reminder_id,
            p_action: action,
            p_growth_enabled: isGrowthEnabled(),
          },
        );
        if (error) throw new Error("growth_reminder_update_failed");
        return data === true;
      },
    ),
  );

  updateReminder("complete_growth_reminder_draft", "complete");
  updateReminder("cancel_growth_reminder_draft", "cancel");

  return server;
}
