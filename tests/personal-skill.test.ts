import test from "node:test";
import assert from "node:assert/strict";

import { buildPersonalAgentSkill } from "../src/lib/agent/personal-skill";

test("builds a portable skill with separate, task-specific prompt patterns", () => {
  const result = buildPersonalAgentSkill([{ title: "Réponse client", conversation_text: "Bonjour, je vous rappelle demain matin." }]);

  assert.match(result, /^---\nname: agent-personnel-skillflow/m);
  assert.match(result, /### Analyser une conversation/);
  assert.match(result, /### Rédiger une réponse/);
  assert.match(result, /### Améliorer un brouillon/);
  assert.match(result, /Bonjour, je vous rappelle demain matin\./);
});

test("redacts personal data from both example titles and conversation text", () => {
  const result = buildPersonalAgentSkill([{
    title: "Écrire à ada@example.com",
    conversation_text: "Répondre à +33 6 12 34 56 78, voir https://example.com/client.",
  }]);

  assert.doesNotMatch(result, /ada@example\.com|https:\/\/example\.com|\+33 6 12 34 56 78/);
  assert.match(result, /\[EMAIL\]/);
  assert.match(result, /\[TÉLÉPHONE\]/);
  assert.match(result, /\[LIEN\]/);
});

test("bounds the number and total size of examples and excludes screenshot paths", () => {
  const examples = Array.from({ length: 10 }, (_, index) => ({
    title: `Exemple ${index}`,
    conversation_text: `texte-${index} ${"a".repeat(100)}`,
    screenshot_paths: ["storage/private/screenshot.png"],
  }));
  const result = buildPersonalAgentSkill(examples);

  assert.match(result, /Exemple 8 — Exemple 7/);
  assert.doesNotMatch(result, /Exemple 9 — Exemple 8/);
  assert.ok((result.match(/### Exemple \d+ —/g) ?? []).length === 8);
  assert.ok(result.length < 22_000);
  assert.doesNotMatch(result, /storage\/private\/screenshot\.png/);
  assert.match(result, /captures d'écran ne sont pas incluses/);
});

test("caps the generated example text size", () => {
  const result = buildPersonalAgentSkill([{ title: "Long", conversation_text: "x".repeat(30_000) }]);
  const capturedText = result.match(/```text\n([\s\S]*?)\n```/)?.[1] ?? "";

  assert.ok(result.length < 16_000);
  assert.equal(capturedText.length, 2_500);
});

test("does not claim that exporting a skill trains or contacts a model", () => {
  const result = buildPersonalAgentSkill([]);

  assert.match(result, /ne lance pas d'entraînement/);
  assert.match(result, /n'envoie les données à un modèle/);
  assert.match(result, /Aucun exemple textuel n'a été ajouté/);
});
