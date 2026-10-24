import type { Product } from "@/types/skillflow";

export const products: Product[] = [
  {
    id: "skill-claude-ops",
    slug: "claude-ops",
    name: "Claude Ops Playbook",
    tagline: "Operational playbooks for shipping AI workflows safely at scale.",
    description:
      "A curated bundle of reusable prompts, deployment templates, and project rituals for teams operating Claude Code and other AI coding agents in production environments.",
    problem:
      "Most teams move fast without process guardrails and lose quality, ownership, or rollback confidence.",
    stack: ["Claude Code", "GitHub", "Supabase", "Vercel"],
    installSteps: [
      "Clone the package into your workspace.",
      "Review the included setup checklist and environment template.",
      "Apply the project guardrails to your repository and deployment flow.",
    ],
    price: 49,
    version: "1.1.0",
    status: "published",
    zipFile: "claude-ops-v1.1.0.zip",
    compatibleAgents: ["Claude Code", "Codex", "Cursor"],
    versions: [
      { version: "1.0.0", date: "2026-01-05", notes: ["Initial release"], status: "published" },
      { version: "1.1.0", date: "2026-02-12", notes: ["Added onboarding checklists and environment templates"], status: "published" },
    ],
  },
  {
    id: "skill-frontend-qa",
    slug: "frontend-qa",
    name: "Frontend QA Pack",
    tagline: "Automated quality checks for web product teams and AI-assisted releases.",
    description:
      "This skill includes release checklists, browser validation prompts, visual QA patterns, and safe deployment workflows for fast-moving digital products.",
    problem:
      "Teams often ship without a shared QA standard, making regressions hard to catch and debugging slower than necessary.",
    stack: ["Next.js", "Playwright", "GitHub Actions", "Vercel"],
    installSteps: [
      "Import the QA checklist into your project board.",
      "Connect the browser validation prompts to your release routine.",
      "Use the sign-off checklist before each production deployment.",
    ],
    price: 79,
    version: "2.0.0",
    status: "published",
    zipFile: "frontend-qa-v2.0.0.zip",
    compatibleAgents: ["Claude Code", "OpenAI Codex", "Gemini"],
    versions: [
      { version: "1.0.0", date: "2025-10-18", notes: ["Initial QA kit"], status: "published" },
      { version: "2.0.0", date: "2026-03-08", notes: ["Expanded browser automation and rollout controls"], status: "published" },
    ],
  },
  {
    id: "skill-growth-engine",
    slug: "growth-engine",
    name: "Growth Engine System",
    tagline: "Launch and optimize product experiments with AI-powered operating rhythms.",
    description:
      "Operational prompts and workflows for growth, analytics, experimentation, and product iteration across marketing, product, and engineering teams.",
    problem:
      "Without a repeatable experiment cadence, teams spend time guessing instead of learning from actual customer signals.",
    stack: ["Notion", "Supabase", "Analytics", "Claude Code"],
    installSteps: [
      "Import the experiment planner into your workspace.",
      "Add the success metrics templated for each feature.",
      "Use the weekly review prompts to prioritize the next release.",
    ],
    price: 99,
    version: "1.2.0",
    status: "published",
    zipFile: "growth-engine-v1.2.0.zip",
    compatibleAgents: ["Claude Code", "Gemini", "Cursor"],
    versions: [
      { version: "1.0.0", date: "2025-12-02", notes: ["Core growth workflow"], status: "published" },
      { version: "1.2.0", date: "2026-04-14", notes: ["Added analytics summaries and iteration loops"], status: "published" },
    ],
  },
];

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((product) => product.slug === slug);
}
