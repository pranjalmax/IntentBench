import { readFile } from "node:fs/promises";
import path from "node:path";

import { Ajv2020 } from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import { describe, expect, it } from "vitest";

const schemaRoot = path.resolve("packages/product-service/schemas");

async function schema(name: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path.join(schemaRoot, name), "utf8")) as Record<string, unknown>;
}

describe("Milestone 2 API schemas", () => {
  it("validates the persisted activity event contract", async () => {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormatsModule.default(ajv);
    const validate = ajv.compile(await schema("verification-activity-1.0.0.schema.json"));

    expect(
      validate({
        schemaVersion: "1.0.0",
        runId: "run_schema",
        sequence: 1,
        occurredAt: "2026-10-09T12:00:00.000Z",
        source: "MODEL",
        kind: "VISIBLE_TEST",
        message: "Visible tests passed in isolation.",
      }),
    ).toBe(true);
  });

  it("distinguishes UNKNOWN and infrastructure outcomes in status responses", async () => {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormatsModule.default(ajv);
    const validate = ajv.compile(await schema("verification-status-1.0.0.schema.json"));
    const base = {
      runId: "run_schema",
      snapshotId: `sha256:${"a".repeat(64)}`,
      status: "FAILED",
      revision: 2,
      createdAt: "2026-10-09T12:00:00.000Z",
      updatedAt: "2026-10-09T12:00:01.000Z",
      error: {
        code: "REVIEW_OUTPUT_INVALID",
        category: "REVIEW",
        message: "invalid output",
        retryable: false,
      },
    };

    expect(validate({ ...base, outcome: "UNKNOWN" })).toBe(true);
    expect(
      validate({
        ...base,
        outcome: "INFRASTRUCTURE_FAILURE",
        error: { ...base.error, code: "EXECUTOR_UNAVAILABLE", category: "INFRASTRUCTURE" },
      }),
    ).toBe(true);
  });
});
