import assert from "node:assert/strict";
import test from "node:test";
import { evaluateScopedAudit, reviewedAdvisory } from "./scoped-release-policy.mjs";

function fixture() {
  return {
    report: {
      auditReportVersion: 2,
      vulnerabilities: {
        picomatch: {
          name: "picomatch",
          severity: "high",
          nodes: ["node_modules/picomatch"],
          via: [
            { name: "picomatch", dependency: "picomatch", severity: "high", url: reviewedAdvisory },
          ],
        },
        vite: { name: "vite", severity: "high", nodes: ["node_modules/vite"], via: ["picomatch"] },
      },
      metadata: {
        vulnerabilities: { info: 0, low: 0, moderate: 0, high: 2, critical: 0, total: 2 },
      },
    },
    lock: {
      packages: {
        "node_modules/picomatch": { version: "4.0.7", dev: true },
        "node_modules/vite": { version: "8.3.4", dev: true },
      },
    },
    exitCode: 1,
  };
}

test("the sole reviewed development advisory is an explicit risk acceptance, not a clean audit", () => {
  const result = evaluateScopedAudit(fixture());
  assert.equal(result.decision, "PASS_WITH_REVIEWED_DEV_RISK");
  assert.equal(result.fullAudit, "FAIL");
  assert.equal(result.affectedPackageEntries, 2);
  assert.deepEqual(result.unresolvedAdvisories, [reviewedAdvisory]);
});

test("a genuinely clean audit needs no exception", () => {
  const input = fixture();
  input.report.vulnerabilities = {};
  input.report.metadata.vulnerabilities.high = 0;
  input.report.metadata.vulnerabilities.total = 0;
  input.exitCode = 0;
  assert.equal(evaluateScopedAudit(input).decision, "PASS");
});

test("a malformed empty findings array is not a clean audit", () => {
  const input = fixture();
  input.report.vulnerabilities = [];
  input.report.metadata.vulnerabilities.high = 0;
  input.report.metadata.vulnerabilities.total = 0;
  input.exitCode = 0;
  assert.throws(() => evaluateScopedAudit(input));
});

for (const [name, change] of [
  [
    "an unknown advisory",
    (input) => {
      input.report.vulnerabilities.picomatch.via[0].url =
        "https://github.com/advisories/GHSA-new-finding";
    },
  ],
  [
    "an additional advisory on the same package",
    (input) => {
      input.report.vulnerabilities.picomatch.via.push({
        ...input.report.vulnerabilities.picomatch.via[0],
        url: "https://github.com/advisories/GHSA-new-finding",
      });
    },
  ],
  [
    "a production dependency",
    (input) => {
      delete input.lock.packages["node_modules/picomatch"].dev;
    },
  ],
  [
    "a missing lockfile node",
    (input) => {
      delete input.lock.packages["node_modules/vite"];
    },
  ],
  [
    "an unreviewed vulnerable version",
    (input) => {
      input.lock.packages["node_modules/picomatch"].version = "3.0.0";
    },
  ],
  [
    "a dangling inherited finding",
    (input) => {
      input.report.vulnerabilities.vite.via = ["missing"];
    },
  ],
  [
    "a cyclic inherited finding",
    (input) => {
      input.report.vulnerabilities.vite.via = ["vite"];
    },
  ],
  [
    "an empty advisory path",
    (input) => {
      input.report.vulnerabilities.vite.via = [];
    },
  ],
  [
    "a different affected package",
    (input) => {
      input.report.vulnerabilities.picomatch.via[0].name = "other";
    },
  ],
  [
    "a severity change",
    (input) => {
      input.report.vulnerabilities.picomatch.severity = "critical";
    },
  ],
  [
    "an incomplete report",
    (input) => {
      delete input.report.metadata;
    },
  ],
  [
    "an inconsistent finding count",
    (input) => {
      input.report.metadata.vulnerabilities.total = 0;
    },
  ],
  [
    "an audit service error",
    (input) => {
      input.report.error = { code: "ENOAUDIT" };
    },
  ],
  [
    "a failed audit process",
    (input) => {
      input.exitCode = 2;
    },
  ],
  [
    "an interrupted audit process",
    (input) => {
      input.exitCode = null;
    },
  ],
  [
    "a zero exit concealing findings",
    (input) => {
      input.exitCode = 0;
    },
  ],
]) {
  test(`the release policy blocks ${name}`, () => {
    const input = fixture();
    change(input);
    assert.throws(() => evaluateScopedAudit(input));
  });
}
