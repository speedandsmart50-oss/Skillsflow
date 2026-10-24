import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

import { products } from "@/features/products/products";
import mcpSkills from "@/features/mcp/skills.json";

function createMcpServer() {
  const server = new McpServer({
    name: "skillflow",
    version: "0.1.0",
  });

  server.registerTool(
    "list_skills",
    {
      title: "Lister les skills",
      description:
        "Recherche les skills utilisables via MCP et les packs SkillFlow publiés dans le catalogue.",
      inputSchema: {
        query: z.string().trim().max(100).optional(),
        limit: z.number().int().min(1).max(20).optional(),
      },
    },
    async ({ query, limit }) => {
      const normalizedQuery = query?.toLocaleLowerCase();
      const catalogSkills = products
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
        "Renvoie le contenu complet d'un skill MCP ou les détails d'un pack SkillFlow publié.",
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

      const product = products.find(
        (item) => item.slug === slug && item.status === "published",
      );

      if (!product) {
        return {
          content: [{ type: "text", text: `Aucun skill publié trouvé pour « ${slug} ».` }],
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
      };

      return {
        content: [{ type: "text", text: JSON.stringify(skill) }],
        structuredContent: skill,
      };
    },
  );

  return server;
}

export async function POST(request: Request) {
  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    maxRequestBodySize: 64 * 1024,
  });

  await server.connect(transport);
  return transport.handleRequest(request);
}

export function GET() {
  return Response.json(
    { error: "Cette connexion MCP utilise Streamable HTTP et accepte les requêtes POST." },
    { status: 405, headers: { Allow: "POST" } },
  );
}
