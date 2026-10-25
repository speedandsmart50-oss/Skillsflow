---
name: fabric-pattern-workflows
description: Design and apply reusable, Markdown-based AI prompt patterns inspired by Fabric when building or improving SkillFlow agent experiences and skill packs.
---

# Fabric-style prompt workflows for SkillFlow

Use this skill when a SkillFlow change needs reusable AI instructions, task-specific agent workflows, or an exportable personalized skill. Fabric organizes prompts around concrete jobs and keeps patterns readable and editable in Markdown; follow that approach without copying Fabric's prompt text or adding its runtime unless the task requires it. See the [Fabric repository](https://github.com/danielmiessler/Fabric) for its stated approach.

## Design a pattern

1. Start from one real user task. Split distinct tasks into separately named patterns instead of one broad prompt.
2. Write the instructions in Markdown. State the role, the task, what input is available, the requested output, and any constraints in the order the model should follow them.
3. Keep user examples as private style/context references. Do not treat examples as verified facts, copy personal details into unrelated outputs, or imply that saved conversations train a model.
4. Be explicit about unavailable capabilities. In particular, do not claim screenshot OCR, automatic model training, or external processing when those are not implemented and enabled.
5. Prefer a portable system prompt or `SKILL.md` users can inspect, edit, and export. Keep generation in the user's browser when it only combines data already loaded for that account.

## Apply changes in this project

- The member's private examples are handled by `src/components/account-conversations.tsx`; pure prompt assembly belongs in a small module under `src/lib/agent/` so it can be validated independently.
- Include only bounded, already-anonymized conversation text. Never include storage paths, signed screenshot URLs, account identifiers, secrets, or another member's data in an export.
- Label what the export contains and does not do. Saved text and screenshots are not model training; screenshots are not readable unless an OCR feature is actually wired in.
- Add focused tests for the generated skill's task structure, content bounds, and privacy invariants. Run the project checks relevant to the change.
