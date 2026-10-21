import { expect, it } from "vitest";
import { calibrateReview } from "../../advanced-verifier/src/gate.js";
import { supportingReview } from "../../product-service/test/test-support.js";
import { requirementEvidence, summarizeReview, verdictExplanation } from "../src/report-view.js";

it("uses persisted coverage references and never counts inconclusive, missing or unrelated records as coverage", () => {
  const review = calibrateReview(supportingReview());
  const original = review.evidence[0];
  if (!original) throw new Error("Missing synthetic evidence");
  review.evidence.push({ ...original, id: "E2", disposition: "INCONCLUSIVE" });
  review.coverage = [{ requirementId: "R1", evidenceIds: ["E2", "E404"] }];
  expect(requirementEvidence(review, "R1").covered).toBe(false);
  expect(summarizeReview(review)).toMatchObject({ required: 1, covered: 0, inconclusive: 1 });
  review.coverage = [{ requirementId: "R1", evidenceIds: ["E1", "E2", "E404"] }];
  expect(requirementEvidence(review, "R1").covered).toBe(true);
  original.requirementIds = ["R2"];
  expect(requirementEvidence(review, "R1").covered).toBe(false);
});

it("keeps contradictions, blockers and a recorded verdict distinct without inferring that covered means satisfied", () => {
  const review = calibrateReview(supportingReview());
  const original = review.evidence[0];
  if (!original) throw new Error("Missing synthetic evidence");
  original.disposition = "CONTRADICTS";
  expect(requirementEvidence(review, "R1")).toMatchObject({
    covered: true,
    supporting: 0,
    contradicting: 1,
  });
  expect(verdictExplanation(review)).toContain("recorded COMPLETE");
  expect(verdictExplanation(review)).not.toContain("supporting evidence");
  expect(summarizeReview(review).blockers).toBe(0);
});
