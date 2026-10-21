import { readFile } from "node:fs/promises";
import path from "node:path";

import { Ajv2020 } from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import { describe, expect, it } from "vitest";

import { createVerificationRun } from "../src/run-state.js";
import { calibrateWithFrozenA11 } from "../src/verifier-adapter.js";

async function validator(name: string) {
  const schema = JSON.parse(
    await readFile(path.resolve("packages/product-core/schemas", `${name}.schema.json`), "utf8"),
  ) as object;
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormatsModule.default(ajv);
  return ajv.compile(schema);
}

const rawReview = {
  schemaVersion: "1.0.0",
  requirements: [
    {
      id: "R1",
      classification: "REQUIRED",
      statement: "The operation returns a new value.",
      criticality: "IMPORTANT",
      observableSuccessCondition: "The returned value is distinct.",
      allowedEvidenceTypes: ["STATIC_SOURCE"],
    },
  ],
  proofObligations: [
    {
      requirementId: "R1",
      proposition: "The return value is newly allocated.",
      evidencePlan: "Inspect the return path.",
    },
  ],
  evidence: [
    {
      id: "E1",
      requirementIds: ["R1"],
      evidenceType: "STATIC_SOURCE",
      reproduction: "Inspect src/value.ts.",
      observedBehavior: "The return path allocates a new object.",
      disposition: "SUPPORTS",
    },
  ],
  proposedFindings: [],
};

describe("versioned product schemas", () => {
  it("validates snapshot manifests and rejects incomplete manifests", async () => {
    const validate = await validator("candidate-snapshot-1.0.0");
    const manifest = {
      schemaVersion: "1.0.0",
      snapshotId: `sha256:${"a".repeat(64)}`,
      contentHash: "a".repeat(64),
      createdAt: "2026-10-09T12:00:00.000Z",
      specPath: "SPEC.md",
      fileCount: 1,
      totalBytes: 6,
      files: [{ relativePath: "SPEC.md", size: 6, sha256: "b".repeat(64) }],
    };

    expect(validate(manifest), JSON.stringify(validate.errors)).toBe(true);
    expect(validate({ ...manifest, snapshotId: undefined })).toBe(false);
  });

  it("validates persisted run records", async () => {
    const validate = await validator("verification-run-1.0.0");
    const run = createVerificationRun({
      runId: "run_schema",
      snapshotId: `sha256:${"c".repeat(64)}`,
      createdAt: "2026-10-09T12:00:00.000Z",
    });

    expect(validate(run), JSON.stringify(validate.errors)).toBe(true);
    expect(validate({ ...run, status: "COMPLETE" })).toBe(false);
  });

  it("validates deterministic calibrated reports", async () => {
    const validate = await validator("verification-report-1.0.0");
    const report = calibrateWithFrozenA11({
      reportId: "report_schema",
      runId: "run_schema",
      snapshotId: `sha256:${"d".repeat(64)}`,
      generatedAt: "2026-10-09T12:00:00.000Z",
      rawReview,
    });

    expect(validate(report), JSON.stringify(validate.errors)).toBe(true);
    expect(validate({ ...report, verdict: "UNKNOWN" })).toBe(false);
  });
});
