import { spawnSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import process from "node:process";
import { evaluateScopedAudit } from "./scoped-release-policy.mjs";

try {
  if (!process.env.npm_execpath) throw new Error("Run through npm run audit:scoped-release");
  const audit = spawnSync(process.execPath, [process.env.npm_execpath, "audit", "--json"], {
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  // Keep the complete registry findings visible, including the real nonzero status.
  process.stdout.write(audit.stdout ?? "");
  process.stderr.write(audit.stderr ?? "");
  if (audit.error || audit.signal) throw new Error("Audit unavailable, interrupted or timed out");
  const result = evaluateScopedAudit({
    report: JSON.parse(audit.stdout),
    lock: JSON.parse(readFileSync("package-lock.json", "utf8")),
    exitCode: audit.status,
  });
  process.stdout.write(
    `\nScoped release policy (full audit status preserved):\n${JSON.stringify(result, null, 2)}\n`,
  );
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `## Static REPLAY security policy\n\nFull npm audit: **${result.fullAudit}** (exit ${result.fullAuditExitCode}; ${result.affectedPackageEntries} affected package entries).\n\nScoped decision: **${result.decision}**.\n\n${result.unresolvedAdvisories.join("\n")}\n\nThis is an unresolved development-tool risk, not a fix. The independent full-audit job retains its failing conclusion. Production-only audit and all static validation gates remain mandatory.\n`,
    );
  }
} catch (error) {
  process.stderr.write(`Scoped release BLOCKED: ${error.message}\n`);
  process.exitCode = 1;
}
