import assert from "node:assert/strict";

export const reviewedAdvisory = "https://github.com/advisories/GHSA-fc5q-39xc-vjpf";

// A deployment policy, not a vulnerability fix or an npm audit replacement.
export function evaluateScopedAudit({ report, lock, exitCode }) {
  assert.ok(exitCode === 0 || exitCode === 1, "Audit did not complete normally");
  assert.ok(report && !report.error && report.auditReportVersion === 2, "Invalid audit report");
  assert.ok(
    report.vulnerabilities &&
      typeof report.vulnerabilities === "object" &&
      !Array.isArray(report.vulnerabilities),
    "Malformed audit findings",
  );
  const findings = Object.entries(report.vulnerabilities);
  const counts = report.metadata?.vulnerabilities;
  assert.ok(counts && counts.total === findings.length, "Incomplete audit metadata");
  assert.equal(exitCode, findings.length === 0 ? 0 : 1, "Audit status contradicts findings");
  const allowedCounts = { info: 0, low: 0, moderate: 0, high: findings.length, critical: 0 };
  for (const [severity, count] of Object.entries(allowedCounts)) {
    assert.equal(counts[severity], count, "Unreviewed advisory severity");
  }

  const visiting = new Set();
  const checked = new Set();
  function check(name) {
    assert.ok(!visiting.has(name), "Cyclic audit dependency path");
    if (checked.has(name)) return;
    const entry = report.vulnerabilities[name];
    assert.ok(entry && entry.name === name && entry.severity === "high", "Unknown audit entry");
    assert.ok(Array.isArray(entry.nodes) && entry.nodes.length > 0, "Missing affected nodes");
    for (const node of entry.nodes) {
      assert.ok(node.endsWith(`node_modules/${name}`), "Unexpected affected node path");
      const installed = lock?.packages?.[node];
      assert.equal(installed?.dev, true, "Affected node is not exclusively development-only");
      if (name === "picomatch") {
        assert.equal(installed.version, "4.0.7", "Unreviewed vulnerable picomatch version");
      }
    }
    assert.ok(Array.isArray(entry.via) && entry.via.length > 0, "Missing advisory path");
    visiting.add(name);
    for (const via of entry.via) {
      if (typeof via === "string") {
        check(via);
      } else {
        assert.ok(
          name === "picomatch" &&
            via?.name === "picomatch" &&
            via.dependency === "picomatch" &&
            via.severity === "high" &&
            via.url === reviewedAdvisory,
          "Unreviewed security advisory; deployment blocked",
        );
      }
    }
    visiting.delete(name);
    checked.add(name);
  }
  for (const [name] of findings) check(name);
  return {
    decision: findings.length ? "PASS_WITH_REVIEWED_DEV_RISK" : "PASS",
    fullAudit: findings.length ? "FAIL" : "PASS",
    fullAuditExitCode: exitCode,
    affectedPackageEntries: findings.length,
    unresolvedAdvisories: findings.length ? [reviewedAdvisory] : [],
    scope: "Static REPLAY only; production-only audit and all artifact gates must separately pass",
  };
}
