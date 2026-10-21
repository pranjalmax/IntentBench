import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { stat } from "node:fs/promises";
import process from "node:process";
import path from "node:path";
import { readVerifiedFile } from "../dist/packages/product-service/src/read-only-files.js";
import { frozenA11Profile } from "../dist/packages/product-core/src/verifier-adapter.js";
import { isPublishablePath, scanText, localLinks, resolveLocalLink } from "./public-audit-lib.mjs";

const root = process.cwd();
const git = (...args) =>
  execFileSync("git", ["-c", `safe.directory=${root.replaceAll("\\", "/")}`, ...args], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  }).trim();
const bytes = async (file, hash, canonical = false) =>
  readVerifiedFile(root, file, 16 * 1024 * 1024, hash, canonical);
const json = async (file) => JSON.parse((await bytes(file)).toString("utf8"));
const manifest = await json("public-file-manifest.json");
const actual = git("ls-files", "--cached", "--others", "--exclude-standard", "-z")
  .split("\0")
  .filter(Boolean)
  .sort();
const expected = [...manifest.files.map((entry) => entry.path), "public-file-manifest.json"].sort();
assert.deepEqual(actual, expected, "Unreviewed file or missing allowlisted file");
const findings = [];
let links = 0;
for (const entry of manifest.files) {
  assert.ok(isPublishablePath(entry.path), `Forbidden public path: ${entry.path}`);
  const data = await bytes(entry.path, entry.sha256, entry.canonicalText);
  if (!entry.canonicalText) continue;
  let text = data.toString("utf8");
  // A fixed container-internal HOME is not a host/personal path. No other exception.
  if (entry.path === "runtime-image/entrypoint.sh")
    text = text.replaceAll(["", "home", "intentbench"].join("/"), "<CONTAINER_HOME>");
  for (const category of scanText(text)) findings.push({ file: entry.path, category });
  if (
    entry.path === "README.md" ||
    entry.path === "LICENSE-DECISION.md" ||
    entry.path === "RELEASE-NOTES.md" ||
    /^docs\/release\/[^/]+\.md$/u.test(entry.path)
  ) {
    for (const target of localLinks(text)) {
      assert.ok(
        (await stat(resolveLocalLink(root, entry.path, target))).isFile(),
        `Broken link: ${entry.path}`,
      );
      links += 1;
    }
  }
}
assert.deepEqual(
  findings,
  [],
  "Privacy/credential pattern found; inspect locations only, not matching values",
);
for (const [file, hash] of [
  ["profiles/a1.1/prompt.md", frozenA11Profile.promptHash],
  ["profiles/a1.1/config.json", frozenA11Profile.configHash],
  ["packages/advanced-verifier/src/gate.ts", frozenA11Profile.gateHash],
])
  await bytes(file, hash);
const evidence = await json("docs/release/evidence-manifest.json");
for (const item of [...evidence.assets, ...evidence.traces])
  await bytes(item.path, item.sha256, item.canonicalText ?? true);
const research = await json("packages/product-service/research-manifest.json");
for (const item of research.files) await bytes(item.path, item.sha256, true);
const result = await json("research/results/final-holdout-evaluation.json");
assert.equal(result.candidates.length, 12);
for (const arm of ["V0", "A1.1"]) assert.equal(result.arms[arm].metrics.correctCount, 8);
const license = await json("third-party/licenses.json");
assert.deepEqual(license.unknown, []);
assert.equal(
  (await json("package.json")).license,
  "UNLICENSED",
  "Owner license approval has not been applied to this candidate",
);
await assert.rejects(stat(path.join(root, "LICENSE")), { code: "ENOENT" });
process.stdout.write(
  `${JSON.stringify({ status: "PASS_WITH_PUBLICATION_BLOCKERS", allowlistedFiles: expected.length, checkedLocalLinks: links, researchPins: research.files.length, reviewedTraces: evidence.traces.length, evidenceArtifacts: evidence.assets.length, privacyFindings: findings, lockedDependencies: license.packages.length, frozenA11BytesMatch: true, finalAccuracy: { V0: "8/12", A11: "8/12" }, projectLicense: "PENDING_APPROVAL", publicationApproved: false, scope: "Git-visible source and reviewed evidence; no Docker/model calls or ignored credential inspection" }, null, 2)}\n`,
);
