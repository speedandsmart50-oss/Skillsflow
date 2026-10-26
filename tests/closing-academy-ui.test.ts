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

test("the primary navigation shows the active page and provides a complete mobile menu", async () => {
  const header = await readFile(new URL("../src/components/site-header-navigation.tsx", import.meta.url), "utf8");
  assert.match(header, /label: "Académies", href: "\/community\/closing-negociation"/);
  assert.match(header, /aria-label="Navigation principale"/);
  assert.match(header, /aria-label="Navigation mobile"/);
  assert.match(header, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(header, /Connexion/);
  assert.match(header, /Mes skills/);
});

test("the community header groups member actions and the values section presents the three principles", async () => {
  const shell = await readFile(new URL("../src/components/community/community-shell.tsx", import.meta.url), "utf8");
  const home = await readFile(new URL("../src/components/community/community-home.tsx", import.meta.url), "utf8");
  assert.match(shell, /href="\/community\/moderation">Modération/);
  assert.match(shell, /href="\/member\/skills">Mes skills/);
  assert.match(shell, /href="\/account">Mon compte/);
  assert.match(shell, /aria-label="Actions de la communauté"/);
  assert.match(home, /id="valeurs"/);
  assert.match(home, /Partager avec respect[\s\S]*Apprendre par la pratique[\s\S]*Avancer sans pression/);
  assert.match(home, /Découvrir l’académie/);
  assert.match(home, /Faire une suggestion/);
});

test("the community sidebar keeps the academy and refresh action available", async () => {
  const home = await readFile(new URL("../src/components/community/community-home.tsx", import.meta.url), "utf8");
  assert.match(home, /filter\(\(channel\) => channel\.slug !== "organisation"\)/);
  assert.match(home, /beforeChannelIndex[\s\S]*coachIndex[\s\S]*channelItems\.splice\(beforeChannelIndex, 0, \{ type: "academy" \}\)/);
  assert.match(home, /item\.type === "academy"[\s\S]*Closing &amp; Négociation/);
  const sidebar = home.indexOf('aria-label="Salons et académie de la communauté"');
  const sidebarEnd = home.indexOf("</nav>", sidebar);
  const refresh = home.indexOf("Actualiser les salons", sidebar);
  assert.ok(sidebar >= 0 && sidebarEnd > sidebar && refresh > sidebarEnd, "refresh should follow every sidebar item");
});
