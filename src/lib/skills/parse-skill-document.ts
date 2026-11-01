import { validateSlug } from "@/lib/security/access";

export type ParsedSkillDocument = {
  name: string;
  slug: string;
  shortDescription: string;
  promise: string;
  useCases: string[];
  requiredInputs: string[];
  outputTypes: string[];
  workflow: string[];
  mcpTools: string[];
  content: string;
};

const SECTION_ALIASES: Record<string, keyof Pick<
  ParsedSkillDocument,
  "shortDescription" | "promise" | "useCases" | "requiredInputs" | "outputTypes" | "workflow" | "mcpTools"
>> = {
  "description courte": "shortDescription",
  "promesse": "promise",
  "cas d'utilisation": "useCases",
  "cas d’usage": "useCases",
  "entrees requises": "requiredInputs",
  "entrées requises": "requiredInputs",
  "formats de sortie": "outputTypes",
  "etapes du workflow": "workflow",
  "étapes du workflow": "workflow",
  "workflow": "workflow",
  "outils mcp": "mcpTools",
};

function normalizeHeading(value: string) {
  return value.trim().replace(/\s+#*$/, "").toLocaleLowerCase("fr");
}

function toSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractListItems(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^(?:[-*+]|\d+[.)])\s+/, ""))
    .filter(Boolean);
}

export function parseSkillDocument(content: string): ParsedSkillDocument | null {
  const normalizedContent = content.trim();
  if (!normalizedContent || normalizedContent.length > 30_000) return null;

  const headings = [...normalizedContent.matchAll(/^#{1,2}\s+(.+?)\s*#*\s*$/gm)];
  const titleHeading = headings.find((heading) => heading[0].startsWith("# "));
  if (!titleHeading) return null;

  const name = titleHeading[1].trim();
  if (name.length < 2 || name.length > 160) return null;
  const slug = toSlug(name);
  if (!validateSlug(slug)) return null;

  const sections = new Map<string, string>();
  const sectionHeadings = headings.filter((heading) => heading[0].startsWith("## "));
  for (const [index, heading] of sectionHeadings.entries()) {
    const start = (heading.index ?? 0) + heading[0].length;
    const end = sectionHeadings[index + 1]?.index ?? normalizedContent.length;
    sections.set(normalizeHeading(heading[1]), normalizedContent.slice(start, end).trim());
  }

  let shortDescription = "";
  let promise = "";
  let useCases: string[] = [];
  let requiredInputs: string[] = [];
  let outputTypes: string[] = [];
  let workflow: string[] = [];
  let mcpTools: string[] = [];
  for (const [heading, value] of sections) {
    const field = SECTION_ALIASES[heading];
    if (!field) continue;
    if (field === "shortDescription") shortDescription = value;
    else if (field === "promise") promise = value;
    else if (field === "useCases") useCases = extractListItems(value);
    else if (field === "requiredInputs") requiredInputs = extractListItems(value);
    else if (field === "outputTypes") outputTypes = extractListItems(value);
    else if (field === "workflow") workflow = extractListItems(value);
    else if (field === "mcpTools") mcpTools = extractListItems(value);
  }

  if (!shortDescription || shortDescription.length > 500) return null;

  return {
    name,
    slug,
    shortDescription,
    promise: promise || shortDescription,
    useCases,
    requiredInputs,
    outputTypes,
    workflow,
    mcpTools,
    content: normalizedContent,
  };
}
