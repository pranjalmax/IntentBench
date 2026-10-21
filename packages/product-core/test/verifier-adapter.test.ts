import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { calibrateWithFrozenA11, frozenA11Profile } from "../src/verifier-adapter.js";

function supportingReview(): unknown {
  return {
    schemaVersion: "1.0.0",
    requirements: [
      {
        id: "R1",
        classification: "REQUIRED",
        statement: "Tags are normalized without mutating the input.",
        criticality: "IMPORTANT",
        observableSuccessCondition: "The returned array is normalized and the input is unchanged.",
        allowedEvidenceTypes: ["STATIC_SOURCE", "VISIBLE_TEST"],
      },
    ],
    proofObligations: [
      {
        requirementId: "R1",
        proposition: "Normalization returns a new array with the required values.",
        evidencePlan: "Inspect the implementation and the visible test.",
      },
    ],
    evidence: [
      {
        id: "E1",
        requirementIds: ["R1"],
        evidenceType: "STATIC_SOURCE",
        reproduction: "Read src/normalize-tags.ts.",
        observedBehavior: "The function maps into a new array and returns a deduplicated array.",
        disposition: "SUPPORTS",
      },
    ],
    proposedFindings: [],
  };
}

describe("frozen A1.1 adapter", () => {
  it("pins the adapter to the immutable A1.1 identities", async () => {
    const freeze = JSON.parse(await readFile("advanced-verifier/freeze.json", "utf8")) as {
      selectedIteration: string;
      promptHash: string;
      configHash: string;
      gateHash: string;
      protocolHash: string;
    };

    expect(freeze).toMatchObject(frozenA11Profile);
  });

  it("derives a COMPLETE report only through the deterministic frozen gate", () => {
    const report = calibrateWithFrozenA11({
      reportId: "report_01",
      runId: "run_01",
      snapshotId: `sha256:${"d".repeat(64)}`,
      generatedAt: "2026-10-09T12:00:00.000Z",
      rawReview: supportingReview(),
    });

    expect(report.verdict).toBe("COMPLETE");
    expect(report.review.coverage).toEqual([{ requirementId: "R1", evidenceIds: ["E1"] }]);
    expect(report.verifier).toEqual(frozenA11Profile);
  });

  it("maps malformed or uncovered model output to explicit review errors", () => {
    const review = supportingReview() as {
      evidence: unknown[];
    };
    review.evidence = [];

    expect(() =>
      calibrateWithFrozenA11({
        reportId: "report_02",
        runId: "run_02",
        snapshotId: `sha256:${"e".repeat(64)}`,
        generatedAt: "2026-10-09T12:00:00.000Z",
        rawReview: review,
      }),
    ).toThrow(expect.objectContaining({ code: "REVIEW_OUTPUT_INVALID" }));
  });
});
