import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the shell shares one live auth session with the site navigation", async () => {
  const provider = await readFile(new URL("../src/components/auth-session-provider.tsx", import.meta.url), "utf8");
  const shell = await readFile(new URL("../src/components/app-shell.tsx", import.meta.url), "utf8");
  const header = await readFile(new URL("../src/components/site-header.tsx", import.meta.url), "utf8");
  const navigation = await readFile(new URL("../src/components/site-header-navigation.tsx", import.meta.url), "utf8");

  assert.match(provider, /onAuthStateChange/);
  assert.match(provider, /status: AuthStatus/);
  assert.match(provider, /IDLE_TIMEOUT_MS = 30 \* 60 \* 1000/);
  assert.match(provider, /signOut\(\{ scope: "local" \}\)/);
  assert.match(provider, /reason=idle/);
  assert.match(shell, /<AuthSessionProvider>/);
  assert.match(header, /useAuthSession/);
  assert.match(navigation, /authStatus === "authenticated"/);
  assert.match(navigation, /authStatus === "loading"/);
  assert.match(navigation, /href="\/account"/);
  assert.match(navigation, /Connexion/);
  assert.match(navigation, /Inscription/);
});

test("an idle timeout explains the reauthentication while preserving the return path", async () => {
  const loginForm = await readFile(new URL("../src/components/login-form.tsx", import.meta.url), "utf8");

  assert.match(loginForm, /searchParams\.get\("reason"\) === "idle"/);
  assert.match(loginForm, /30 minutes sans activité/);
  assert.match(loginForm, /Se reconnecter/);
  assert.match(loginForm, /Continuer avec Google/);
});

test("private pages keep server-side authentication guards", async () => {
  const privatePages = [
    "../src/app/account/page.tsx",
    "../src/app/member/page.tsx",
    "../src/app/community/page.tsx",
    "../src/app/community/private-messages/page.tsx",
  ];

  for (const page of privatePages) {
    const source = await readFile(new URL(page, import.meta.url), "utf8");
    assert.match(source, /requirePageUser/);
  }
});
