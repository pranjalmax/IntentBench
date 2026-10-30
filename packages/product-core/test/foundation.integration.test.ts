import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  FileRunStore,
  calibrateWithFrozenA11,
  createVerificationRun,
  intakeRepositoryArchive,
  transitionVerificationRun,
} from "../src/index.js";
import { fixtureEntries, writeZip } from "./zip-test-helper.js";
import { removeTestDirectory } from "./temp-cleanup.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => removeTestDirectory(root)));
});

describe("product foundation", () => {
  it("persists a real snapshot and a gate-derived terminal report without executing candidate code", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "intentbench-product-foundation-"));
    temporaryRoots.push(root);
    const archivePath = path.join(root, "candidate.zip");
    await writeZip(
      archivePath,
      await fixtureEntries(path.resolve("packages/product-core/test/fixtures/synthetic-notes")),
    );
    const snapshot = await intakeRepositoryArchive({
      archivePath,
      snapshotsRoot: path.join(root, "snapshots"),
      createdAt: "2026-10-09T12:00:00.000Z",
    });
    const store = new FileRunStore(path.join(root, "runs"));
    let run = createVerificationRun({
      runId: "run_foundation",
      snapshotId: snapshot.snapshotId,
      createdAt: "2026-10-09T12:00:01.000Z",
    });
    await store.create(run);
    run = transitionVerificationRun(run, {
      to: "REVIEWING",
      at: "2026-10-09T12:00:02.000Z",
      expectedRevision: run.revision,
    });
    await store.append(run);
    run = transitionVerificationRun(run, {
      to: "CALIBRATING",
      at: "2026-10-09T12:00:03.000Z",
      expectedRevision: run.revision,
    });
    await store.append(run);
    const report = calibrateWithFrozenA11({
      reportId: "report_foundation",
      runId: run.runId,
      snapshotId: snapshot.snapshotId,
      generatedAt: "2026-10-09T12:00:04.000Z",
      rawReview: {
        schemaVersion: "1.0.0",
        requirements: [
          {
            id: "R1",
            classification: "REQUIRED",
            statement: "Tags are normalized without mutating the input.",
            criticality: "IMPORTANT",
            observableSuccessCondition:
              "The returned array is normalized and the input is unchanged.",
            allowedEvidenceTypes: ["STATIC_SOURCE"],
          },
        ],
        proofObligations: [
          {
            requirementId: "R1",
            proposition: "The implementation returns a new normalized array.",
            evidencePlan: "Inspect the direct implementation.",
          },
        ],
        evidence: [
          {
            id: "E1",
            requirementIds: ["R1"],
            evidenceType: "STATIC_SOURCE",
            reproduction: "Read src/normalize-tags.ts.",
            observedBehavior:
              "A mapped array is passed into a new Set and expanded into a new array.",
            disposition: "SUPPORTS",
          },
        ],
        proposedFindings: [],
      },
    });
    run = transitionVerificationRun(run, {
      to: "SUCCEEDED",
      at: "2026-10-09T12:00:05.000Z",
      expectedRevision: run.revision,
      verdict: report.verdict,
      reportId: report.reportId,
    });
    await store.append(run);

    expect((await store.read(run.runId)).verdict).toBe("COMPLETE");
    expect(report.snapshotId).toBe(snapshot.snapshotId);
    expect(snapshot.fileCount).toBe(4);
  });
});
