import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { localLinks, resolveLocalLink, scanText, isPublishablePath } from "./public-audit-lib.mjs";

test("sealed/internal/credential paths cannot enter a public allowlist", () => {
  for (const name of [
    "intentbench/dev/private/oracle.ts",
    "experiments/results.json",
    ".intentbench-auth/auth.json",
    "data/truth.json",
    "private/notes.md",
    "keys/local.pem",
    "../outside.txt",
  ])
    assert.equal(isPublishablePath(name), false, name);
  assert.equal(isPublishablePath("packages/product-core/src/archive.ts"), true);
  assert.equal(isPublishablePath("research/results/final-holdout-evaluation.json"), true);
});

test("credential detection reports categories, never the matching value", () => {
  const synthetic = "sk-proj-" + "x".repeat(48);
  const findings = scanText(`example=${synthetic}`);
  assert.deepEqual(findings, ["credential-pattern"]);
  assert.ok(!JSON.stringify(findings).includes(synthetic));
  assert.deepEqual(scanText("authentication is mounted read-only; TOKEN_PLACEHOLDER"), []);
  assert.deepEqual(scanText("intentbench-task-" + "x".repeat(48)), []);
});

test("personal path detection handles escaped JSON paths without exposing names", () => {
  const slash = String.fromCharCode(92);
  const personal = ["C:", "Users", "Example", "file.txt"].join(slash);
  assert.deepEqual(scanText(JSON.stringify({ path: personal })), ["personal-path"]);
  assert.deepEqual(scanText("D:/public-fixture/src/index.ts"), []);
});

test("links include images and HTML attributes but exclude web URLs", () => {
  assert.deepEqual(
    localLinks(
      '[guide](SETUP.md) ![shot](assets/a.png) <img src="assets/b.png"> [web](https://example.com)',
    ),
    ["SETUP.md", "assets/a.png", "assets/b.png"],
  );
});

test("local links cannot escape the repository or introduce active schemes", () => {
  const root = path.resolve("release-test-root");
  assert.equal(
    resolveLocalLink(root, "docs/guide.md", "../README.md"),
    path.join(root, "README.md"),
  );
  for (const target of [
    "../../outside.txt",
    "javascript:alert(1)",
    "C:/outside.txt",
    "/outside.txt",
  ])
    assert.throws(() => resolveLocalLink(root, "docs/guide.md", target));
});
