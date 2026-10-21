import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ProductError } from "../src/errors.js";
import { FileRunStore } from "../src/run-store.js";
import { createVerificationRun, transitionVerificationRun } from "../src/run-state.js";
import type { VerificationRunRecord } from "../src/schemas.js";

const temporaryRoots: string[] = [];

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "intentbench-product-runs-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("durable verification runs", () => {
  it("persists append-only revisions that survive a new store instance", async () => {
    const root = await tempRoot();
    const store = new FileRunStore(root);
    const created = createVerificationRun({
      runId: "run_01",
      snapshotId: `sha256:${"a".repeat(64)}`,
      createdAt: "2026-10-09T12:00:00.000Z",
    });
    await store.create(created);
    const reviewing = transitionVerificationRun(created, {
      to: "REVIEWING",
      at: "2026-10-09T12:00:01.000Z",
      expectedRevision: 0,
    });
    await store.append(reviewing);

    const reopened = new FileRunStore(root);
    await expect(reopened.read("run_01")).resolves.toEqual(reviewing);
    await expect(reopened.history("run_01")).resolves.toEqual([created, reviewing]);
  });

  it("preserves the existing run when duplicate creation loses the exclusive race", async () => {
    const root = await tempRoot();
    const store = new FileRunStore(root);
    const created = createVerificationRun({
      runId: "run_duplicate",
      snapshotId: `sha256:${"f".repeat(64)}`,
      createdAt: "2026-10-09T12:00:00.000Z",
    });
    await store.create(created);

    await expect(store.create(created)).rejects.toMatchObject({
      code: "RUN_CONFLICT",
    });
    await expect(store.read(created.runId)).resolves.toEqual(created);
  });

  it("refuses to persist a record that violates the versioned run contract", async () => {
    const root = await tempRoot();
    const store = new FileRunStore(root);
    const created = createVerificationRun({
      runId: "run_invalid",
      snapshotId: `sha256:${"0".repeat(64)}`,
      createdAt: "2026-10-09T12:00:00.000Z",
    });
    const invalid = { ...created, status: "SUCCEEDED" } as unknown as VerificationRunRecord;

    await expect(store.create(invalid)).rejects.toMatchObject({ code: "RUN_STORE_CORRUPT" });
    await expect(store.read(created.runId)).rejects.toMatchObject({ code: "RUN_NOT_FOUND" });
  });

  it("rejects illegal transitions and stale revisions", () => {
    const created = createVerificationRun({
      runId: "run_02",
      snapshotId: `sha256:${"b".repeat(64)}`,
      createdAt: "2026-10-09T12:00:00.000Z",
    });

    expect(() =>
      transitionVerificationRun(created, {
        to: "SUCCEEDED",
        at: "2026-10-09T12:00:01.000Z",
        expectedRevision: 0,
        verdict: "COMPLETE",
        reportId: "report_01",
      }),
    ).toThrow(ProductError);
    expect(() =>
      transitionVerificationRun(created, {
        to: "REVIEWING",
        at: "2026-10-09T12:00:01.000Z",
        expectedRevision: 2,
      }),
    ).toThrow(expect.objectContaining({ code: "RUN_CONFLICT" }));
  });

  it("requires verdict provenance for successful terminal runs", () => {
    const pending = createVerificationRun({
      runId: "run_03",
      snapshotId: `sha256:${"c".repeat(64)}`,
      createdAt: "2026-10-09T12:00:00.000Z",
    });
    const reviewing = transitionVerificationRun(pending, {
      to: "REVIEWING",
      at: "2026-10-09T12:00:01.000Z",
      expectedRevision: 0,
    });
    const calibrating = transitionVerificationRun(reviewing, {
      to: "CALIBRATING",
      at: "2026-10-09T12:00:02.000Z",
      expectedRevision: 1,
    });

    expect(() =>
      transitionVerificationRun(calibrating, {
        to: "SUCCEEDED",
        at: "2026-10-09T12:00:03.000Z",
        expectedRevision: 2,
      }),
    ).toThrow(expect.objectContaining({ code: "RUN_INVALID_TRANSITION" }));
  });
});
