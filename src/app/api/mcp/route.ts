import { randomUUID } from "node:crypto";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

import { getCatalogProductBySlug, getCatalogProducts } from "@/features/products/catalog";
import mcpSkills from "@/features/mcp/skills.json";
import { hashMcpKey, parseMcpBearerToken } from "@/lib/security/mcp-keys";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Product } from "@/types/skillflow";

type McpCaller = { userId: string } | null;

async function authenticateMcpKey(request: Request): Promise<McpCaller | Response> {
  const authorization = request.headers.get("authorization");
  if (!authorization) return null;

  const key = parseMcpBearerToken(authorization);
  if (!key) {
    return Response.json({ error: "ClÃ© MCP invalide." }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("mcp_keys")
      .select("id, user_id")
      .eq("key_hash", hashMcpKey(key))
      .eq("status", "active")
      .maybeSingle();

    if (error) {
      console.error("Could not authenticate MCP key:", error.message);
      return Response.json({ error: "Lâ€™authentification MCP est temporairement indisponible." }, { status: 503 });
    }
    if (!data) {
      return Response.json({ error: "ClÃ© MCP invalide ou rÃ©voquÃ©e." }, { status: 401 });
    }

    const { error: updateError } = await supabase
      .from("mcp_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", data.id);
    if (updateError) console.error("Could not update MCP key usage:", updateError.message);

    return { userId: data.user_id };
  } catch (error) {
    console.error("MCP key authentication is unavailable:", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Lâ€™authentification MCP est temporairement indisponible." }, { status: 503 });
  }
}

function isResponse(value: McpCaller | Response): value is Response {
  return value instanceof Response;
}

function createMcpServer(caller: McpCaller) {
  const server = new McpServer({
    name: "skillflow",
    version: "0.1.0",
  });

  server.registerTool(
    "list_skills",
    {
      title: "Lister les skills",
      description:
        "Recherche les skills utilisables via MCP et les packs SkillFlow publiÃ©s dans le catalogue.",
      inputSchema: {
        query: z.string().trim().max(100).optional(),
        limit: z.number().int().min(1).max(20).optional(),
      },
    },
    async ({ query, limit }) => {
      const normalizedQuery = query?.toLocaleLowerCase();
      let catalogProducts: Product[] = [];
      try {
        catalogProducts = await getCatalogProducts();
      } catch (error) {
        console.error("Could not list catalogue skills via MCP:", error instanceof Error ? error.message : "Unknown error");
      }

      const catalogSkills = catalogProducts
        .filter((product) => product.status === "published")
        .filter((product) => {
          if (!normalizedQuery) {
            return true;
          }

          const searchableText = [
            product.name,
            product.tagline,
            product.description,
            ...product.stack,
            ...product.compatibleAgents,
          ]
            .join(" ")
            .toLocaleLowerCase();

          return searchableText.includes(normalizedQuery);
        })
        .map(({ slug, name, tagline, description, stack, compatibleAgents, version }) => ({
          slug,
          name,
          tagline,
          description,
          stack,
          compatibleAgents,
          version,
        }));
      const bundledSkills = mcpSkills
        .filter((skill) => {
          if (!normalizedQuery) {
            return true;
          }

          return [
            skill.slug,
            skill.name,
            skill.title,
            skill.description,
            skill.instructions,
            ...skill.references.map((reference) => reference.content),
          ]
            .join(" ")
            .toLocaleLowerCase()
            .includes(normalizedQuery);
        })
        .map((skill) => ({
          slug: skill.slug,
          name: skill.title,
          tagline: skill.description,
          description: skill.description,
          stack: ["MCP"],
          compatibleAgents: ["Claude", "MCP"],
          version: "1.0.0",
        }));
      const skills = [...catalogSkills, ...bundledSkills].slice(0, limit ?? 10);

      return {
        content: [{ type: "text", text: JSON.stringify({ skills }) }],
        structuredContent: { skills },
      };
    },
  );

  server.registerTool(
    "get_skill",
    {
      title: "Consulter un skill",
      description:
        "Renvoie le contenu complet d'un skill gratuit, ou un lien privÃ© temporaire vers le pack achetÃ© dans SkillFlow.",
      inputSchema: {
        slug: z.string().trim().min(1).max(100),
      },
    },
    async ({ slug }) => {
      const bundledSkill = mcpSkills.find((skill) => skill.slug === slug);

      if (bundledSkill) {
        const skill = {
          slug: bundledSkill.slug,
          name: bundledSkill.title,
          description: bundledSkill.description,
          compatibleAgents: ["Claude", "MCP"],
          version: "1.0.0",
          files: [
            { path: "SKILL.md", content: bundledSkill.instructions },
            ...bundledSkill.references,
          ],
        };

        return {
          content: [{ type: "text", text: JSON.stringify(skill) }],
          structuredContent: skill,
        };
      }

      let product: Product | undefined;
      try {
        product = await getCatalogProductBySlug(slug);
      } catch (error) {
        console.error("Could not load MCP catalogue product:", error instanceof Error ? error.message : "Unknown error");
      }

      if (!product) {
        return {
          content: [{ type: "text", text: `Aucun skill publiÃ© trouvÃ© pour Â« ${slug} Â».` }],
          isError: true,
        };
      }

      if (!caller) {
        return {
          content: [{ type: "text", text: "Ce pack est rÃ©servÃ© aux clients. CrÃ©ez une clÃ© MCP dans votre compte SkillFlow et connectez-vous avec Authorization: Bearer <clÃ©> aprÃ¨s votre achat." }],
          isError: true,
        };
      }

      const supabase = getSupabaseAdminClient();
      const { data: entitlement, error: entitlementError } = await supabase
        .from("entitlements")
        .select("id")
        .eq("user_id", caller.userId)
        .eq("product_id", product.id)
        .eq("status", "active")
        .maybeSingle();

      if (entitlementError) {
        console.error("Could not verify MCP entitlement:", entitlementError.message);
        return {
          content: [{ type: "text", text: "Impossible de vÃ©rifier votre achat pour le moment." }],
          isError: true,
        };
      }
      if (!entitlement) {
        return {
          content: [{ type: "text", text: "Aucun achat actif ne donne accÃ¨s Ã  ce pack dans ce compte SkillFlow." }],
          isError: true,
        };
      }

      const { data: productFile, error: productFileError } = await supabase
        .from("products")
        .select("zip_path")
        .eq("id", product.id)
        .eq("status", "published")
        .is("archived_at", null)
        .maybeSingle();
      if (productFileError || !productFile?.zip_path) {
        console.error("Could not resolve MCP product archive:", productFileError?.message ?? "Archive path missing");
        return {
          content: [{ type: "text", text: "Lâ€™archive de ce pack nâ€™est pas encore disponible." }],
          isError: true,
        };
      }

      const expiresInSeconds = 600;
      const { data: signedArchive, error: signedUrlError } = await supabase.storage
        .from("product-packs")
        .createSignedUrl(productFile.zip_path, expiresInSeconds);
      if (signedUrlError || !signedArchive?.signedUrl) {
        console.error("Could not create MCP archive link:", signedUrlError?.message ?? "No signed URL returned");
        return {
          content: [{ type: "text", text: "Le lien temporaire vers le pack nâ€™a pas pu Ãªtre crÃ©Ã©." }],
          isError: true,
        };
      }

      const skill = {
        slug: product.slug,
        name: product.name,
        tagline: product.tagline,
        description: product.description,
        problem: product.problem,
        stack: product.stack,
        installSteps: product.installSteps,
        compatibleAgents: product.compatibleAgents,
        version: product.version,
        versions: product.versions.filter((version) => version.status === "published"),
        archive: {
          fileName: product.zipFile,
          downloadUrl: signedArchive.signedUrl,
          expiresInSeconds,
        },
      };

      return {
        content: [
          { type: "text", text: JSON.stringify(skill) },
          {
            type: "resource_link",
            name: product.zipFile,
            uri: signedArchive.signedUrl,
            mimeType: "application/zip",
            description: `TÃ©lÃ©charger le pack achetÃ©. Ce lien expire dans ${expiresInSeconds / 60} minutes.`,
          },
        ],
        structuredContent: skill,
      };
    },
  );

  const withMember = async (skillId: string | undefined, toolName: string, input: Record<string, unknown>, operation: (supabase: ReturnType<typeof getSupabaseAdminClient>, userId: string) => Promise<unknown>) => {
    if (!caller) return { content: [{ type: "text" as const, text: "Authentification requise. Connectez une clé MCP personnelle depuis votre espace SkillFlow." }], isError: true };
    const supabase = getSupabaseAdminClient();
    const { count, error: limitError } = await supabase.from("mcp_tool_usage").select("id", { count: "exact", head: true }).eq("user_id", caller.userId).gte("created_at", new Date(Date.now() - 60_000).toISOString());
    if (limitError) return { content: [{ type: "text" as const, text: "Journal MCP indisponible. Appliquez la migration 011 avant les outils privés." }], isError: true };
    if ((count ?? 0) >= 60) return { content: [{ type: "text" as const, text: "Limite temporaire atteinte : 60 appels MCP par minute." }], isError: true };
    if (skillId) {
      const { data: access, error } = await supabase.rpc("can_access_skill", { p_user_id: caller.userId, p_skill_id: skillId });
      if (error || !access) return { content: [{ type: "text" as const, text: "Accès à ce skill requis ou migration 011 non appliquée." }], isError: true };
    }
    try {
      const result = await operation(supabase, caller.userId);
      const { error } = await supabase.from("mcp_tool_usage").insert({ user_id: caller.userId, skill_id: skillId ?? null, tool_name: toolName, input_summary: input, output_summary: { completed: true }, status: "success" });
      if (error) console.error("Could not log MCP usage:", error.message);
      const serialized = JSON.stringify(result);
      return { content: [{ type: "text" as const, text: serialized }], structuredContent: result as Record<string, unknown> };
    } catch (error) {
      console.error(`MCP tool ${toolName} failed:`, error instanceof Error ? error.message : "Unknown error");
      await supabase.from("mcp_tool_usage").insert({ user_id: caller.userId, skill_id: skillId ?? null, tool_name: toolName, input_summary: input, output_summary: {}, status: "failed" });
      return { content: [{ type: "text" as const, text: "Cette action est temporairement indisponible." }], isError: true };
    }
  };

  server.registerTool("list_available_skills", { title: "Lister mes skills", description: "Retourne uniquement les skills actifs auxquels le membre authentifié a accès.", inputSchema: {} }, async () => {
    return withMember(undefined, "list_available_skills", {}, async (supabase, userId) => {
      const { data: skills, error } = await supabase.from("skills").select("id,slug,name,short_description,category_id").eq("is_active", true);
      if (error) throw error;
      const accessResults = await Promise.all((skills ?? []).map((skill) => supabase.rpc("can_access_skill", { p_user_id: userId, p_skill_id: skill.id })));
      if (accessResults.some((result) => result.error)) throw new Error("Skill access unavailable");
      return { skills: (skills ?? []).filter((_, index) => accessResults[index].data === true) };
    });
  });

  server.registerTool("get_skill_details", { title: "Détails d’un skill", description: "Retourne les détails et le workflow d’un skill accessible.", inputSchema: { skill_id: z.string().uuid() } }, async ({ skill_id }) => withMember(skill_id, "get_skill_details", { skill_id }, async (supabase) => {
    const { data, error } = await supabase.from("skills").select("id,slug,name,short_description,long_description,promise,required_inputs,output_types,workflow").eq("id", skill_id).eq("is_active", true).single();
    if (error) throw error;
    return data;
  }));

  server.registerTool("start_skill_configuration", { title: "Démarrer la configuration", description: "Crée une configuration privée pour un skill auquel le membre a accès.", inputSchema: { skill_id: z.string().uuid() } }, async ({ skill_id }) => withMember(skill_id, "start_skill_configuration", { skill_id }, async (supabase, userId) => {
    const { data, error } = await supabase.from("skill_configurations").upsert({ user_id: userId, skill_id, configuration_data: {}, status: "in_progress" }, { onConflict: "user_id,skill_id", ignoreDuplicates: true }).select("id,configuration_data,status").maybeSingle();
    if (error) throw error;
    if (data) return data;
    const existing = await supabase.from("skill_configurations").select("id,configuration_data,status").eq("user_id", userId).eq("skill_id", skill_id).single();
    if (existing.error) throw existing.error;
    return existing.data;
  }));

  server.registerTool("update_skill_configuration", { title: "Mettre à jour la configuration", description: "Enregistre les réponses du membre sans accepter de user_id fourni par le modèle.", inputSchema: { skill_id: z.string().uuid(), configuration: z.record(z.string(), z.unknown()) } }, async ({ skill_id, configuration }) => withMember(skill_id, "update_skill_configuration", { skill_id, fields: Object.keys(configuration) }, async (supabase, userId) => {
    if (JSON.stringify(configuration).length > 30000) throw new Error("Configuration too large");
    const { data, error } = await supabase.from("skill_configurations").upsert({ user_id: userId, skill_id, configuration_data: configuration, status: "in_progress", updated_at: new Date().toISOString() }, { onConflict: "user_id,skill_id" }).select("id,configuration_data,status,updated_at").single();
    if (error) throw error;
    return data;
  }));

  server.registerTool("list_member_files", { title: "Lister mes fichiers de skill", description: "Liste les métadonnées des fichiers du membre pour un skill accessible.", inputSchema: { skill_id: z.string().uuid() } }, async ({ skill_id }) => withMember(skill_id, "list_member_files", { skill_id }, async (supabase, userId) => {
    const { data, error } = await supabase.from("uploaded_files").select("id,file_name,file_type,extraction_status,created_at").eq("user_id", userId).eq("skill_id", skill_id).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return { files: data };
  }));

  server.registerTool("list_generated_outputs", { title: "Lister mes livrables", description: "Liste les livrables du membre pour un skill accessible.", inputSchema: { skill_id: z.string().uuid() } }, async ({ skill_id }) => withMember(skill_id, "list_generated_outputs", { skill_id }, async (supabase, userId) => {
    const { data, error } = await supabase.from("generated_outputs").select("id,output_type,content,status,created_at").eq("user_id", userId).eq("skill_id", skill_id).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return { outputs: data };
  }));

  server.registerTool("rate_agent_response", { title: "Évaluer une réponse", description: "Enregistre une évaluation ou une correction privée du membre.", inputSchema: { skill_id: z.string().uuid(), agent_message_id: z.string().uuid().optional(), rating: z.enum(["perfect", "correct", "rejected"]), corrected_content: z.string().max(12000).optional() } }, async ({ skill_id, agent_message_id, rating, corrected_content }) => withMember(skill_id, "rate_agent_response", { skill_id, rating, corrected: Boolean(corrected_content) }, async (supabase, userId) => {
    if (agent_message_id) {
      const { data: message } = await supabase.from("agent_messages").select("id").eq("id", agent_message_id).eq("user_id", userId).maybeSingle();
      if (!message) throw new Error("Message not found");
    }
    const { data, error } = await supabase.from("feedback_ratings").insert({ user_id: userId, skill_id, agent_message_id: agent_message_id ?? null, rating, corrected_content: corrected_content ?? null }).select("id,rating,created_at").single();
    if (error) throw error;
    return data;
  }));

  server.registerTool("extract_conversation_data", { title: "Extraire une conversation", description: "Prépare le fichier pour une extraction manuelle; l’OCR n’est pas configuré.", inputSchema: { skill_id: z.string().uuid(), file_id: z.string().uuid() } }, async ({ skill_id, file_id }) => withMember(skill_id, "extract_conversation_data", { skill_id, file_id }, async (supabase, userId) => {
    const { data: file, error } = await supabase.from("uploaded_files").select("id,extraction_status").eq("id", file_id).eq("user_id", userId).eq("skill_id", skill_id).maybeSingle();
    if (error || !file) throw new Error("File not found");
    return { file_id: file.id, status: file.extraction_status, message: "OCR indisponible : ajoutez ou validez manuellement le texte anonymisé avant toute analyse." };
  }));
  server.registerTool("anonymize_extracted_data", { title: "Anonymiser les données", description: "Anonymise localement courriels, téléphones, liens et identifiants usuels.", inputSchema: { skill_id: z.string().uuid(), text: z.string().min(1).max(30000) } }, async ({ skill_id, text }) => withMember(skill_id, "anonymize_extracted_data", { skill_id, chars: text.length }, async () => ({ text: text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]").replace(/(?:\+?\d[\d .()/-]{7,}\d)/g, "[TÉLÉPHONE]").replace(/https?:\/\/\S+/gi, "[LIEN]") })));

  server.registerTool("upload_skill_file", { title: "Importer un fichier", description: "Stocke un fichier privé dans le bucket du membre pour un skill accessible.", inputSchema: { skill_id: z.string().uuid(), file_name: z.string().trim().min(1).max(180), mime_type: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain", "application/json"]), content_base64: z.string().min(1).max(10_000_000) } }, async ({ skill_id, file_name, mime_type, content_base64 }) => withMember(skill_id, "upload_skill_file", { skill_id, file_name, mime_type, encoded_chars: content_base64.length }, async (supabase, userId) => {
    const bytes = Buffer.from(content_base64, "base64");
    if (!bytes.length || bytes.length > 7 * 1024 * 1024 || bytes.toString("base64").replace(/=+$/, "") !== content_base64.replace(/=+$/, "")) throw new Error("Invalid or oversized file");
    const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf", "text/plain": "txt", "application/json": "json" };
    const storagePath = `${userId}/${skill_id}/${randomUUID()}.${extensions[mime_type]}`;
    const { error: uploadError } = await supabase.storage.from("skill-files").upload(storagePath, bytes, { contentType: mime_type, upsert: false });
    if (uploadError) throw uploadError;
    const { data, error } = await supabase.from("uploaded_files").insert({ user_id: userId, skill_id, file_name: file_name.replace(/[\\/\0]/g, "_").slice(0, 180), file_type: mime_type, storage_path: storagePath }).select("id,file_name,file_type,extraction_status,created_at").single();
    if (error) { await supabase.storage.from("skill-files").remove([storagePath]); throw error; }
    return data;
  }));
  const unavailable = (name: string, title: string, description: string) => server.registerTool(name, { title, description, inputSchema: { skill_id: z.string().uuid() } }, async ({ skill_id }) => withMember(skill_id, name, { skill_id }, async () => { throw new Error("AI/OCR provider unavailable"); }));
  unavailable("analyze_communication_style", "Analyser le style", "Analyse IA indisponible tant qu’un fournisseur n’est pas configuré.");
  unavailable("generate_communication_profile", "Générer le profil", "Génération IA indisponible tant qu’un fournisseur n’est pas configuré.");
  unavailable("chat_with_skill_agent", "Discuter avec l’agent", "Chat IA indisponible tant qu’un fournisseur n’est pas configuré.");
  unavailable("generate_skill_output", "Générer un livrable", "Génération IA indisponible tant qu’un fournisseur n’est pas configuré.");
  unavailable("update_profile_from_feedback", "Apprendre d’une correction", "Mise à jour du profil désactivée jusqu’à la sélection d’un modèle et validation des retours.");

  for (const [name, template] of Object.entries({
    prospect_like_me: "Rédige un message de prospection avec le profil de communication validé du membre.",
    answer_objection: "Prépare une réponse respectueuse à l’objection, sans pression ni promesse non vérifiée.",
    create_follow_up_sequence: "Prépare une séquence de relance espacée et adaptée au contexte.",
    analyze_prospect_conversation: "Analyse une conversation préalablement anonymisée et validée.",
    create_content_in_my_style: "Rédige un contenu à partir d’exemples de style fournis et validés.",
    build_premium_offer: "Aide à structurer une offre et signale les hypothèses à valider.",
    create_support_agent: "Propose une réponse support basée sur une base de connaissances validée.",
    create_email_sequence: "Prépare une séquence e-mail respectueuse des préférences du destinataire."
  })) {
    server.registerPrompt(name, { description: template }, async () => ({ messages: [{ role: "user", content: { type: "text", text: template } }] }));
  }
  server.registerResource("skills", "skillvault://skills", { title: "Catalogue des skills", description: "Skills actifs dans SkillFlow.", mimeType: "application/json" }, async (uri) => {
    const { data, error } = await getSupabaseAdminClient().from("skills").select("id,slug,name,short_description,category_id,required_inputs,output_types,workflow").eq("is_active", true).order("name");
    if (error) throw error;
    return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify({ skills: data }) }] };
  });
  const memberResourceTemplate = new ResourceTemplate("skillvault://skills/{skillId}/{section}", { list: undefined });
  server.registerResource("member-skill-data", memberResourceTemplate, { title: "Données privées du skill", description: "Configuration, profil, fichiers ou livrables du membre authentifié.", mimeType: "application/json" }, async (uri, variables) => {
    if (!caller) throw new Error("Authentification MCP requise.");
    const skillId = String(variables.skillId);
    const section = String(variables.section);
    if (!["configuration", "profile", "files", "outputs"].includes(section)) throw new Error("Section invalide.");
    const supabase = getSupabaseAdminClient();
    const { count, error: rateError } = await supabase.from("mcp_tool_usage").select("id", { count: "exact", head: true }).eq("user_id", caller.userId).gte("created_at", new Date(Date.now() - 60_000).toISOString());
    if (rateError || (count ?? 0) >= 60) throw new Error("Limite d’utilisation MCP atteinte ou journal indisponible.");
    const { data: access, error: accessError } = await supabase.rpc("can_access_skill", { p_user_id: caller.userId, p_skill_id: skillId });
    if (accessError || !access) throw new Error("Accès au skill requis.");
    const tables: Record<string, string> = { configuration: "skill_configurations", profile: "communication_profiles", files: "uploaded_files", outputs: "generated_outputs" };
    const columns: Record<string, string> = { configuration: "id,configuration_data,status,updated_at", profile: "id,summary,version,is_active,updated_at", files: "id,file_name,file_type,extraction_status,created_at", outputs: "id,output_type,content,status,created_at" };
    const { data, error } = await supabase.from(tables[section]).select(columns[section]).eq("user_id", caller.userId).eq("skill_id", skillId);
    if (error) throw error;
    await supabase.from("mcp_tool_usage").insert({ user_id: caller.userId, skill_id: skillId, tool_name: `resource_${section}`, input_summary: {}, output_summary: { count: data?.length ?? 0 }, status: "success" });
    return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify({ [section]: data }) }] };
  });
  return server;
}

export async function POST(request: Request) {
  const caller = await authenticateMcpKey(request);
  if (isResponse(caller)) return caller;

  const server = createMcpServer(caller);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    maxRequestBodySize: 11 * 1024 * 1024,
  });

  await server.connect(transport);
  return transport.handleRequest(request);
}

export function GET() {
  return Response.json(
    { error: "Cette connexion MCP utilise Streamable HTTP et accepte les requÃªtes POST." },
    { status: 405, headers: { Allow: "POST" } },
  );
}
