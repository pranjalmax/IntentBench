import type { VerificationReport } from "../../product-core/src/index.js";

function markdownText(value: string): string {
  return value.replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function renderReportJson(report: VerificationReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function renderReportMarkdown(report: VerificationReport): string {
  const lines = [
    "# IntentBench report",
    "",
    `- Verdict: **${report.verdict}**`,
    `- Run: \`${report.runId}\``,
    `- Snapshot: \`${report.snapshotId}\``,
    `- Generated: ${report.generatedAt}`,
    `- Verifier: ${report.verifier.selectedIteration}`,
    "",
    "## Requirement ledger",
    "",
  ];
  for (const requirement of report.review.requirements) {
    lines.push(
      `### ${requirement.id} — ${requirement.classification}`,
      "",
      markdownText(requirement.statement),
      "",
      `Success condition: ${markdownText(requirement.observableSuccessCondition)}`,
      "",
    );
  }
  lines.push("## Evidence", "");
  for (const evidence of report.review.evidence) {
    lines.push(
      `### ${evidence.id} — ${evidence.disposition}`,
      "",
      `Requirements: ${evidence.requirementIds.join(", ")}`,
      "",
      `Reproduction: ${markdownText(evidence.reproduction)}`,
      "",
      `Observed: ${markdownText(evidence.observedBehavior)}`,
      "",
    );
  }
  lines.push("## Blocking findings", "");
  if (report.review.blockingFindings.length === 0) lines.push("None.", "");
  for (const finding of report.review.blockingFindings) {
    lines.push(
      `### ${finding.id} — ${finding.requirementId ?? "unmapped"}`,
      "",
      markdownText(finding.claim),
      "",
      `Observed: ${markdownText(finding.observedBehavior)}`,
      "",
      `Expected: ${markdownText(finding.expectedBehavior)}`,
      "",
    );
  }
  lines.push("## Advisories", "");
  if (report.review.advisories.length === 0) lines.push("None.", "");
  for (const finding of report.review.advisories) {
    lines.push(`- ${finding.id}: ${markdownText(finding.claim)}`);
  }
  return `${lines.join("\n").trimEnd()}\n`;
}
