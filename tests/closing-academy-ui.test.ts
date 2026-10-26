import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Closing & Négociation is linked from the existing community area", async () => {
  const home = await readFile(new URL("../src/components/community/community-home.tsx", import.meta.url), "utf8");
  assert.match(home, /href="\/community\/closing-negociation"/);
  assert.match(home, /Closing &amp; Négociation/);
  const page = await readFile(new URL("../src/app/community/closing-negociation/page.tsx", import.meta.url), "utf8");
  assert.match(page, /export default async function ClosingNegociationPage/);
  assert.match(page, /href="\/community"/);
});

test("the academy roadmap reflects the supplied four levels and ethical requirements", async () => {
  const page = await readFile(new URL("../src/app/community/closing-negociation/page.tsx", import.meta.url), "utf8");
  for (const title of ["Fondamentaux", "Intermédiaire", "Avancé", "Expert & mentor"]) {
    assert.ok(page.includes(`title: "${title}"`), `missing level ${title}`);
  }
  assert.match(page, /Aucune promesse|ne promet ni revenus/i);
  assert.match(page, /refus doit être respecté/);
  assert.match(page, /prefers-reduced-motion|motion-reduce/);
  assert.match(page, /<details/);
});

test("the academy is available in the site header on desktop and mobile", async () => {
  const header = await readFile(new URL("../src/components/site-header.tsx", import.meta.url), "utf8");
  assert.match(header, /label: "Académies", href: "\/community\/closing-negociation"/);
  assert.match(header, /href="\/community\/closing-negociation" aria-label="Académies" title="Académies"/);
});
