import { calibrateReview } from "../../advanced-verifier/src/gate.js";

import { ProductError } from "./errors.js";
import {
  productSchemaVersion,
  type FrozenVerifierIdentity,
  type VerificationReport,
} from "./schemas.js";

export const frozenA11Profile: FrozenVerifierIdentity = Object.freeze({
  selectedIteration: "A1.1",
  promptHash: "0b9c8e11296b1735a51b59f322a0d5fadaaeadf56688061056d3b0bf57c1d3c2",
  configHash: "f5ad0f7cca23196d73a76fa61c64b9b27d43382fd90d03cdd6fbc9609eab902a",
  gateHash: "9ea3ed019e8cb7d0b316960f4a0c5091aa69149a81f875c9166322c840764728",
  protocolHash: "eceea1297edfb27b83a2280d99d48c834eae73b5dae6e2dff2c8cf3b929031fe",
  implementationCommit: "7eb249805213e10ba904a6e774d61433ad23bfe8",
});

export interface CalibrateFrozenA11Input {
  reportId: string;
  runId: string;
  snapshotId: string;
  generatedAt: string;
  rawReview: unknown;
}

export function calibrateWithFrozenA11(input: CalibrateFrozenA11Input): VerificationReport {
  let review;
  try {
    review = calibrateReview(input.rawReview);
  } catch (error) {
    const message = error instanceof Error ? error.message : "review output is invalid";
    const missingEvidence = message.startsWith("insufficient evidence coverage for ");
    throw new ProductError(
      missingEvidence ? "REVIEW_EVIDENCE_INCOMPLETE" : "REVIEW_OUTPUT_INVALID",
      message,
      { category: "REVIEW", cause: error },
    );
  }
  return {
    schemaVersion: productSchemaVersion,
    reportId: input.reportId,
    runId: input.runId,
    snapshotId: input.snapshotId,
    generatedAt: input.generatedAt,
    verifier: frozenA11Profile,
    verdict: review.verdict,
    review,
  };
}
