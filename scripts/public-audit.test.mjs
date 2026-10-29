import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { localLinks, resolveLocalLink, scanText, isPublishablePath } from "./public-audit-lib.mjs";
import * as audit from "./public-audit-lib.mjs";

const reviewedManifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));
const reviewedLock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url)));

test("the reviewed dependency graph accepts the supported patch cohort", () => {
  assert.equal(typeof audit.assertDependencyPolicy, "function");
  audit.assertDependencyPolicy(reviewedManifest, reviewedLock);
});

test("the dependency gate rejects loss of the peer-resolution constraint", () => {
  assert.equal(typeof audit.assertDependencyPolicy, "function");
  const manifest = structuredClone(reviewedManifest);
  delete manifest.overrides.vitest;
  assert.throws(() => audit.assertDependencyPolicy(manifest, reviewedLock));
});

test("the dependency gate rejects a vulnerable mocker despite a patched parent", () => {
  assert.equal(typeof audit.assertDependencyPolicy, "function");
  const lock = structuredClone(reviewedLock);
  lock.packages["node_modules/@vitest/mocker"].version = "4.1.11";
  assert.throws(() => audit.assertDependencyPolicy(reviewedManifest, lock));
});

test("the dependency gate rejects the original vulnerable Undici version", () => {
  assert.equal(typeof audit.assertDependencyPolicy, "function");
  const lock = structuredClone(reviewedLock);
  lock.packages["node_modules/undici"].version = "7.30.0";
  assert.throws(() => audit.assertDependencyPolicy(reviewedManifest, lock));
});

test("a patched top-level Undici does not hide a vulnerable nested copy", () => {
  const lock = structuredClone(reviewedLock);
  lock.packages["node_modules/jsdom/node_modules/undici"] = {
    ...lock.packages["node_modules/undici"],
    version: "7.30.0",
  };
  assert.throws(() => audit.assertDependencyPolicy(reviewedManifest, lock));
});

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
