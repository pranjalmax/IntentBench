import type { CalibratedReview } from "../../advanced-verifier/src/gate.js";

/** Presentation only: joins persisted records, without re-grading or changing the verdict. */
export function requirementEvidence(review: CalibratedReview, requirementId: string) {
  const records = review.evidence.filter((record) => record.requirementIds.includes(requirementId));
  const declared = new Set(
    review.coverage
      .filter((entry) => entry.requirementId === requirementId)
      .flatMap((entry) => entry.evidenceIds),
  );
  return {
    records,
    covered: records.some(
      (record) => declared.has(record.id) && record.disposition !== "INCONCLUSIVE",
    ),
    supporting: records.filter((record) => record.disposition === "SUPPORTS").length,
    contradicting: records.filter((record) => record.disposition === "CONTRADICTS").length,
    inconclusive: records.filter((record) => record.disposition === "INCONCLUSIVE").length,
  };
}

export function summarizeReview(review: CalibratedReview) {
  const required = review.requirements.filter(
    (requirement) => requirement.classification === "REQUIRED",
  );
  return {
    required: required.length,
    covered: required.filter((requirement) => requirementEvidence(review, requirement.id).covered)
      .length,
    evidence: review.evidence.length,
    inconclusive: review.evidence.filter((record) => record.disposition === "INCONCLUSIVE").length,
    supporting: review.evidence.filter((record) => record.disposition === "SUPPORTS").length,
    contradicting: review.evidence.filter((record) => record.disposition === "CONTRADICTS").length,
    blockers: review.blockingFindings.length,
  };
}

export function verdictExplanation(review: CalibratedReview): string {
  const summary = summarizeReview(review);
  return `The calibration gate recorded ${review.verdict} with ${String(summary.blockers)} blocking ${summary.blockers === 1 ? "finding" : "findings"}. ${String(summary.covered)} of ${String(summary.required)} required items have recorded decisive evidence. ${String(summary.inconclusive)} ${summary.inconclusive === 1 ? "check is" : "checks are"} inconclusive.`;
}
