import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { isMessagingEnabled } from "../config";
import { isConfiguredMessagingAdmin } from "./access-policy";
import { sendMessagingMessage } from "../service/send-message";
import type { MessagingSendResult } from "../service/send-coordinator";
import type { SendMessageRequest } from "../rules/types";

export type MessagingMcpCaller = { userId: string; keyId: string } | null;

const CONTACT_STATUSES = [
  "new",
  "in_discussion",
  "interested",
  "converted",
  "opted_out",
] as const;

interface ContactListResult {
  contacts: Array<{
    id: string;
    channel: string;
    display_name: string | null;
    status: string;
    consent_given: boolean;
    consent_at: string | null;
    consent_source: string | null;
    last_inbound_at: string | null;
  }>;
}

interface ConversationResult {
  contact: { id: string; channel: string; display_name: string | null; status: string };
  messages: Array<{
    id: string;
    direction: string;
    content: string;
    content_type: string;
    message_type: string;
    template_name: string | null;
    status: string;
    created_at: string;
  }>;
}

function mcpResult(value: unknown) {
  const structuredContent = value as Record<string, unknown>;
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    structuredContent,
  };
}

function mcpError(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

export function registerMessagingTools(
  server: McpServer,
  caller: MessagingMcpCaller,
): McpServer {
  if (!caller) return server;

  const withMessagingAdmin = async <T>(
    toolName: string,
    inputSummary: Record<string, unknown>,
    outputSummary: (result: T) => Record<string, unknown>,
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
          console.error("Could not log denied messaging MCP usage", {
            toolName,
            code: logError.code,
          });
        }
        return mcpError("Ces outils de messagerie sont réservés à l’administrateur configuré.");
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
        console.error("Could not log messaging MCP usage", {
          toolName,
          code: logError.code,
        });
      }
      return mcpResult(result);
    } catch (error) {
      const errorCode = error instanceof Error ? error.message : "unknown_error";
      console.error(`Messaging MCP tool ${toolName} failed`, { code: errorCode });
      const { error: logError } = await supabase.from("mcp_tool_usage").insert({
        user_id: caller.userId,
        skill_id: null,
        tool_name: toolName,
        input_summary: inputSummary,
        output_summary: { error: "unavailable" },
        status: "failed",
      });
      if (logError) {
        console.error("Could not log failed messaging MCP usage", {
          toolName,
          code: logError.code,
        });
      }
      return mcpError("Cette action de messagerie est temporairement indisponible.");
    }
  };

  server.registerTool(
    "list_whatsapp_contacts",
    {
      title: "Lister les contacts de messagerie",
      description:
        "Liste les contacts WhatsApp ou Messenger de l’administrateur configuré (WhatsApp par défaut). Les identifiants retournés servent à consulter une conversation.",
      inputSchema: {
        channel: z.enum(["whatsapp", "messenger", "instagram"]).optional(),
        status: z.enum(CONTACT_STATUSES).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      },
    },
    async ({ channel, status, limit }) => {
      const boundedLimit = limit ?? 25;
      const selectedChannel = channel ?? "whatsapp";
      return withMessagingAdmin<ContactListResult>(
        "list_whatsapp_contacts",
        { channel: selectedChannel, status: status ?? null, limit: boundedLimit },
        (result) => ({ channel: selectedChannel, count: result.contacts.length }),
        async (userId) => {
          let query = getSupabaseAdminClient()
            .from("msg_contacts")
            .select("id,channel,display_name,status,consent_given,consent_at,consent_source,last_inbound_at")
            .eq("user_id", userId)
            .eq("channel", selectedChannel);
          if (status) query = query.eq("status", status);

          const { data, error } = await query
            .order("last_inbound_at", { ascending: false, nullsFirst: false })
            .limit(boundedLimit);
          if (error) throw new Error("contact_list_failed");
          return { contacts: (data ?? []) as ContactListResult["contacts"] };
        },
      );
    },
  );

  server.registerTool(
    "get_whatsapp_conversation",
    {
      title: "Lire une conversation",
      description:
        "Retourne les derniers messages WhatsApp ou Messenger du contact enregistré par son identifiant SkillFlow. Aucun numéro de téléphone n’est accepté.",
      inputSchema: {
        contact_id: z.string().uuid(),
        channel: z.enum(["whatsapp", "messenger", "instagram"]).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      },
    },
    async ({ contact_id, channel, limit }) => {
      const boundedLimit = limit ?? 25;
      return withMessagingAdmin<ConversationResult>(
        "get_whatsapp_conversation",
        { contact_id, channel: channel ?? null, limit: boundedLimit },
        (result) => ({ count: result.messages.length, contact_id: result.contact.id }),
        async (userId) => {
          const supabase = getSupabaseAdminClient();
          const { data: contact, error: contactError } = await supabase
            .from("msg_contacts")
            .select("id,channel,display_name,status")
            .eq("id", contact_id)
            .eq("user_id", userId)
            .in("channel", channel ? [channel] : ["whatsapp", "messenger", "instagram"])
            .maybeSingle();
          if (contactError) throw new Error("contact_lookup_failed");
          if (!contact) throw new Error("contact_not_found");

          const { data: messages, error: messagesError } = await supabase
            .from("msg_messages")
            .select("id,direction,content,content_type,message_type,template_name,status,created_at")
            .eq("contact_id", contact.id)
            .eq("user_id", userId)
            .eq("channel", contact.channel)
            .order("created_at", { ascending: false })
            .limit(boundedLimit);
          if (messagesError) throw new Error("conversation_lookup_failed");

          return {
            contact,
            messages: ((messages ?? []).reverse()) as ConversationResult["messages"],
          } satisfies ConversationResult;
        },
      );
    },
  );

  server.registerTool(
    "send_whatsapp_message",
    {
      title: "Répondre sur WhatsApp",
      description:
        "Prépare un brouillon en mode DRY_RUN ou envoie une réponse via le contact WhatsApp enregistré. Exige un opt-in explicite et les autres règles d’envoi ; aucun numéro libre n’est accepté. L’envoi réel nécessite un drapeau supplémentaire désactivé par défaut.",
      inputSchema: {
        contact_id: z.string().uuid(),
        text: z.string().trim().min(1).max(4096),
      },
    },
    async ({ contact_id, text }) => withMessagingAdmin<MessagingSendResult>(
      "send_whatsapp_message",
      { contact_id, text_chars: text.length },
      (result: MessagingSendResult) => ({
        status: result.status,
        reason: result.status === "denied" ? result.reason : undefined,
      }),
      async (userId) => {
        const request: SendMessageRequest = {
          ownerUserId: userId,
          actorUserId: userId,
          contactId: contact_id,
          channel: "whatsapp",
          message: { type: "free", content: text },
        };
        return sendMessagingMessage(request);
      },
    ),
  );

  server.registerTool(
    "create_whatsapp_followup_draft",
    {
      title: "Préparer un suivi WhatsApp",
      description:
        "Crée un suivi WhatsApp en brouillon. Il ne sera planifié qu’après approbation explicite. L’heure de traitement peut être décalée de 0 à 15 minutes pour répartir la charge.",
      inputSchema: {
        contact_id: z.string().uuid(),
        scheduled_at: z.string().datetime(),
        message_type: z.enum(["free", "template"]),
        text: z.string().trim().min(1).max(4096).optional(),
        template_name: z.string().regex(/^[a-z0-9_]{1,512}$/).optional(),
        template_language: z.string().regex(/^[A-Za-z0-9_-]{1,32}$/).optional(),
        idempotency_key: z.string().uuid(),
      },
    },
    async ({
      contact_id,
      scheduled_at,
      message_type,
      text,
      template_name,
      template_language,
      idempotency_key,
    }) => withMessagingAdmin(
      "create_whatsapp_followup_draft",
      { contact_id, scheduled_at, message_type, idempotency_key: idempotency_key ?? null },
      (result: Record<string, unknown>) => ({
        followup_id: result.followup_id,
        status: result.status,
        due_at: result.due_at,
        jitter_seconds: result.jitter_seconds,
      }),
      async (userId) => {
        if (message_type === "free" ? !text || template_name || template_language
          : text !== undefined || !template_name || !template_language) {
          throw new Error("invalid_followup_message");
        }
        const { data, error } = await getSupabaseAdminClient().rpc(
          "create_whatsapp_followup_draft",
          {
            p_user_id: userId,
            p_actor_user_id: userId,
            p_contact_id: contact_id,
            p_scheduled_at: scheduled_at,
            p_message_type: message_type,
            p_message_content: message_type === "free" ? text : null,
            p_template_name: message_type === "template" ? template_name : null,
            p_template_language: message_type === "template" ? template_language : null,
            p_idempotency_key: idempotency_key,
            p_messaging_enabled: isMessagingEnabled(),
          },
        );
        if (error || !Array.isArray(data) || data.length !== 1) {
          throw new Error(error ? "followup_create_failed" : "invalid_followup_create_response");
        }
        return data[0] as Record<string, unknown>;
      },
    ),
  );

  server.registerTool(
    "list_whatsapp_followups",
    {
      title: "Lister les suivis WhatsApp",
      description: "Liste les suivis WhatsApp de l’administrateur avec leurs statuts et heures planifiées.",
      inputSchema: {
        status: z.enum([
          "draft", "scheduled", "processing", "awaiting_approval", "sent", "cancelled", "failed",
        ]).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      },
    },
    async ({ status, limit }) => withMessagingAdmin(
      "list_whatsapp_followups",
      { status: status ?? null, limit: limit ?? 25 },
      (result: { followups: unknown[] }) => ({ count: result.followups.length }),
      async (userId) => {
        let query = getSupabaseAdminClient()
          .from("msg_followups")
          .select("id,contact_id,status,scheduled_at,due_at,jitter_seconds,message_type,message_content,template_name,template_language,cancellation_reason,result_message_id,created_at")
          .eq("user_id", userId);
        if (status) query = query.eq("status", status);
        const { data, error } = await query
          .order("due_at", { ascending: true })
          .limit(limit ?? 25);
        if (error) throw new Error("followup_list_failed");
        return { followups: data ?? [] };
      },
    ),
  );

  server.registerTool(
    "approve_whatsapp_followup",
    {
      title: "Approuver un suivi WhatsApp",
      description: "Approuve un brouillon de suivi et le rend éligible au traitement planifié.",
      inputSchema: { followup_id: z.string().uuid() },
    },
    async ({ followup_id }) => withMessagingAdmin(
      "approve_whatsapp_followup",
      { followup_id },
      (approved: boolean) => ({ approved }),
      async (userId) => {
        const { data, error } = await getSupabaseAdminClient().rpc(
          "approve_whatsapp_followup",
          {
            p_user_id: userId,
            p_actor_user_id: userId,
            p_followup_id: followup_id,
            p_messaging_enabled: isMessagingEnabled(),
          },
        );
        if (error) throw new Error("followup_approval_failed");
        return data === true;
      },
    ),
  );

  server.registerTool(
    "cancel_whatsapp_followup",
    {
      title: "Annuler un suivi WhatsApp",
      description: "Annule un brouillon, un suivi planifié ou un brouillon de message en attente d’approbation.",
      inputSchema: { followup_id: z.string().uuid() },
    },
    async ({ followup_id }) => withMessagingAdmin(
      "cancel_whatsapp_followup",
      { followup_id },
      (cancelled: boolean) => ({ cancelled }),
      async (userId) => {
        const { data, error } = await getSupabaseAdminClient().rpc(
          "cancel_whatsapp_followup",
          {
            p_user_id: userId,
            p_actor_user_id: userId,
            p_followup_id: followup_id,
            p_messaging_enabled: isMessagingEnabled(),
          },
        );
        if (error) throw new Error("followup_cancellation_failed");
        return data === true;
      },
    ),
  );

  server.registerTool(
    "approve_and_send_whatsapp_followup_draft",
    {
      title: "Approuver un brouillon de suivi",
      description:
        "Approuve explicitement et tente d’envoyer le brouillon produit par un suivi. Les règles de consentement et de fenêtre sont réévaluées à cet instant. En mode simulation, le brouillon n’est pas envoyé.",
      inputSchema: {
        followup_id: z.string().uuid(),
      },
    },
    async ({ followup_id }) => withMessagingAdmin<MessagingSendResult | { status: "sent"; followupId: string }>(
      "approve_and_send_whatsapp_followup_draft",
      { followup_id },
      (result) => ({ status: result.status }),
      async (userId) => {
        const supabase = getSupabaseAdminClient();
        const { data: followup, error: followupError } = await supabase
          .from("msg_followups")
          .select("id,contact_id,result_message_id,status")
          .eq("id", followup_id)
          .eq("user_id", userId)
          .eq("status", "awaiting_approval")
          .maybeSingle();
        if (followupError) throw new Error("followup_lookup_failed");
        if (!followup?.result_message_id) throw new Error("followup_draft_not_found");

        const { data: draft, error: draftError } = await supabase
          .from("msg_messages")
          .select("id,content,message_type,template_name,template_language,status")
          .eq("id", followup.result_message_id)
          .eq("user_id", userId)
          .eq("contact_id", followup.contact_id)
          .eq("channel", "whatsapp")
          .eq("direction", "outbound")
          .eq("status", "draft")
          .maybeSingle();
        if (draftError) throw new Error("followup_message_lookup_failed");
        if (!draft) throw new Error("followup_draft_not_found");

        const request: SendMessageRequest = {
          ownerUserId: userId,
          actorUserId: userId,
          contactId: followup.contact_id,
          channel: "whatsapp",
          draftMessageId: draft.id,
          message: draft.message_type === "template"
            ? {
              type: "template",
              templateName: draft.template_name ?? "",
              language: draft.template_language ?? "",
            }
            : { type: "free", content: draft.content },
        };
        let result: MessagingSendResult;
        try {
          result = await sendMessagingMessage(request);
        } catch (error) {
          const { error: failureError } = await supabase.rpc(
            "fail_whatsapp_followup_draft",
            {
              p_user_id: userId,
              p_actor_user_id: userId,
              p_followup_id: followup_id,
              p_message_id: draft.id,
              p_messaging_enabled: isMessagingEnabled(),
            },
          );
          if (failureError) {
            console.error("Could not mark failed WhatsApp follow-up draft for manual review", {
              followupId: followup_id,
              code: failureError.code,
            });
          }
          throw error;
        }
        if (result.status !== "sent") return result;

        const { data: resolved, error: resolveError } = await supabase.rpc(
          "approve_whatsapp_followup_draft",
          {
            p_user_id: userId,
            p_actor_user_id: userId,
            p_followup_id: followup_id,
            p_messaging_enabled: isMessagingEnabled(),
          },
        );
        if (resolveError || resolved !== true) {
          console.error("Could not resolve sent WhatsApp follow-up draft", {
            followupId: followup_id,
            code: resolveError?.code ?? "followup_not_resolved",
          });
          throw new Error("followup_resolution_failed");
        }
        return { status: "sent", followupId: followup_id };
      },
    ),
  );

  return server;
}
