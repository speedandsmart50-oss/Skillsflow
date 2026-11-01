import assert from "node:assert/strict";
import test from "node:test";
import { parseSkillDocument, toEditableSkillDocument } from "../src/lib/skills/parse-skill-document";

test("parses a structured skill document and keeps the complete instructions", () => {
  const content = `# Coach commercial

## Description courte
Aide à préparer des rendez-vous clients.

## Domaine
Vente

## Promesse
Un plan concret pour chaque rendez-vous.

## Cas d'utilisation
- Préparer un appel
- Répondre aux objections

## Entrées requises
- Profil du client
- Objectif du rendez-vous

## Formats de sortie
- Plan d'appel

## Étapes du workflow
1. Clarifier le besoin
2. Préparer les questions

## Instructions
Toujours rester honnête et précis.`;

  const skill = parseSkillDocument(content);
  assert.ok(skill);
  assert.equal(skill.name, "Coach commercial");
  assert.equal(skill.slug, "coach-commercial");
  assert.equal(skill.domain, "Vente");
  assert.equal(skill.shortDescription, "Aide à préparer des rendez-vous clients.");
  assert.equal(skill.promise, "Un plan concret pour chaque rendez-vous.");
  assert.deepEqual(skill.useCases, ["Préparer un appel", "Répondre aux objections"]);
  assert.deepEqual(skill.requiredInputs, ["Profil du client", "Objectif du rendez-vous"]);
  assert.deepEqual(skill.outputTypes, ["Plan d'appel"]);
  assert.deepEqual(skill.workflow, ["Clarifier le besoin", "Préparer les questions"]);
  assert.equal(skill.content, content);
});

test("uses a general domain when the document omits it", () => {
  const skill = parseSkillDocument("# Skill\n\n## Description courte\nUn résumé.");
  assert.equal(skill?.domain, "Général");
});

test("prepares existing plain-text descriptions for editing without losing their content", () => {
  const document = toEditableSkillDocument({
    name: "Skill existant",
    description: "Instructions historiques complètes.",
    domain: "Conseil",
  });
  assert.match(document, /^# Skill existant/m);
  assert.match(document, /## Domaine\nConseil/);
  assert.match(document, /## Instructions\nInstructions historiques complètes\./);
  assert.ok(parseSkillDocument(document));
});

test("keeps an existing structured skill document intact for editing", () => {
  const document = "# Skill\n\n## Description courte\nRésumé.\n\n## Instructions\nTexte.";
  assert.equal(toEditableSkillDocument({ name: "Autre nom", description: document }), document);
});

test("rejects a document without a title or a short description", () => {
  assert.equal(parseSkillDocument("## Description courte\nUn résumé."), null);
  assert.equal(parseSkillDocument("# Skill sans description"), null);
});

test("rejects an oversized document and descriptions longer than 500 characters", () => {
  assert.equal(parseSkillDocument(`# Skill\n\n## Description courte\n${"x".repeat(501)}`), null);
  assert.equal(parseSkillDocument(`# Skill\n\n## Description courte\n${"x".repeat(30_001)}`), null);
});
