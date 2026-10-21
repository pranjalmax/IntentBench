import { describe, expect, it } from "vitest";

import { calibrateReview } from "../src/gate.js";

function review(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: "1.0.0",
    requirements: [
      {
        id: "R1",
        classification: "REQUIRED",
        statement: "Writes must be tenant scoped.",
        criticality: "CRITICAL",
        observableSuccessCondition: "A cross-tenant write is rejected.",
        allowedEvidenceTypes: ["TARGETED_RUNTIME"],
      },
    ],
    proofObligations: [
      {
        requirementId: "R1",
        proposition: "Cross-tenant writes cannot apply.",
        evidencePlan: "Attempt a deterministic cross-tenant write.",
      },
    ],
    evidence: [
      {
        id: "E1",
        requirementIds: ["R1"],
        evidenceType: "TARGETED_RUNTIME",
        reproduction: "Call update with tenant B through tenant A.",
        observedBehavior: "The write applied.",
        disposition: "CONTRADICTS",
      },
    ],
    proposedFindings: [
      {
        id: "F1",
        proposedSeverity: "BLOCKING",
        requirementId: "R1",
        requirementStatement: "Writes must be tenant scoped.",
        claim: "Cross-tenant write applied.",
        evidenceIds: ["E1"],
        evidenceType: "TARGETED_RUNTIME",
        reproduction: "Call update with tenant B through tenant A.",
        observedBehavior: "The write applied.",
        expectedBehavior: "The write is rejected.",
        confidence: "HIGH",
        calibration: {
          explicitRequirement: true,
          concreteObservedEvidence: true,
          reproducible: true,
          materialToCompliance: true,
        },
      },
    ],
    ...overrides,
  };
}

describe("calibrateReview", () => {
  it("keeps a requirement-grounded reproduced contradiction blocking", () => {
    const result = calibrateReview(review());
    expect(result.verdict).toBe("INCOMPLETE");
    expect(result.blockingFindings).toHaveLength(1);
  });

  it("downgrades a concern that is not an explicit required condition", () => {
    const input = review();
    const findings = input.proposedFindings as Array<Record<string, unknown>>;
    findings[0] = { ...findings[0], requirementId: null, requirementStatement: null };
    const result = calibrateReview(input);
    expect(result.verdict).toBe("COMPLETE");
    expect(result.advisories[0]?.calibrationReason).toContain(
      "no explicit REQUIRED requirement mapping",
    );
  });

  it("downgrades hypothetical and low-confidence blockers", () => {
    const input = review();
    const findings = input.proposedFindings as Array<Record<string, unknown>>;
    findings[0] = {
      ...findings[0],
      confidence: "MEDIUM",
      calibration: {
        explicitRequirement: true,
        concreteObservedEvidence: false,
        reproducible: false,
        materialToCompliance: true,
      },
    };
    const result = calibrateReview(input);
    expect(result.verdict).toBe("COMPLETE");
    expect(result.blockingFindings).toHaveLength(0);
  });

  it("rejects reviews that leave a required item without conclusive evidence", () => {
    const input = review({ proposedFindings: [] });
    const evidence = input.evidence as Array<Record<string, unknown>>;
    evidence[0] = { ...evidence[0], disposition: "INCONCLUSIVE" };
    expect(() => calibrateReview(input)).toThrow(/insufficient evidence coverage/u);
  });

  it("accepts a globally supported evidence type omitted from the agent's planning list", () => {
    const input = review();
    const evidence = input.evidence as Array<Record<string, unknown>>;
    evidence[0] = { ...evidence[0], evidenceType: "PUBLIC_CONFIG" };
    const findings = input.proposedFindings as Array<Record<string, unknown>>;
    findings[0] = { ...findings[0], evidenceType: "PUBLIC_CONFIG" };
    const result = calibrateReview(input);
    expect(result.verdict).toBe("INCOMPLETE");
    expect(result.blockingFindings).toHaveLength(1);
  });
});
