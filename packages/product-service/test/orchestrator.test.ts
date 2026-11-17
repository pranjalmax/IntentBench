import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { removeTestDirectory } from "../../product-core/test/temp-cleanup.js";

import {
  FileRunStore,
  ProductError,
  VerificationService,
  createVerificationRun,
} from "../src/index.js";
import {
  FakeModelRunner,
  contradictoryReview,
  supportingReview,
  writeFixtureZip,
} from "./test-support.js";

const roots: string[] = [];

async function setupArchive(root: string): Promise<string> {
  const archive = path.join(root, "candidate.zip");
  await writeFixtureZip(
    path.resolve("packages/product-service/test/fixtures/synthetic-counter"),
    archive,
  );
  return archive;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => removeTestDirectory(root)));
});

describe("verification orchestration", () => {
  it("persists real activity, calibrated evidence, and COMPLETE exports", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "intentbench-service-"));
    roots.push(root);
    const archivePath = await setupArchive(root);
    const runner = new FakeModelRunner(async (input) => {
      await input.onActivity({
        kind: "VISIBLE_TEST",
        message:
          "Visible tests passed in D:\\sensitive-fixture\\candidate with token sk-aaaaaaaaaaaaaaaa",
      });
      return { rawReview: supportingReview(), startedAt: input.now(), completedAt: input.now() };
    });
    const service = new VerificationService({ dataRoot: path.join(root, "data"), runner });

    const created = await service.createRun({ archivePath });
    const status = await service.waitForTerminal(created.runId);
    const events = await service.getEvents(created.runId);
    const report = await service.getReport(created.runId);

    expect(status).toMatchObject({ status: "SUCCEEDED", outcome: "COMPLETE" });
    expect(events.map((event) => event.kind)).toContain("VISIBLE_TEST");
    expect(events.map((event) => event.message).join(" ")).not.toMatch(
      /D:\\sensitive-fixture|sk-aaaaaaaaaaaaaaaa/u,
    );
    expect(report.review.evidence[0]?.observedBehavior).toContain("new object");
    expect(await service.exportReport(created.runId, "markdown")).toContain("# IntentBench report");
    expect(JSON.parse(await service.exportReport(created.runId, "json"))).toMatchObject({
      verdict: "COMPLETE",
    });
  });

  it("keeps semantic INCOMPLETE, UNKNOWN review output, and infrastructure failure distinct", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "intentbench-service-"));
    roots.push(root);
    const archivePath = await setupArchive(root);
    const cases = [
      {
        id: "semantic",
        runner: new FakeModelRunner((input) =>
          Promise.resolve({
            rawReview: contradictoryReview(),
            startedAt: input.now(),
            completedAt: input.now(),
          }),
        ),
        outcome: "INCOMPLETE",
      },
      {
        id: "unknown",
        runner: new FakeModelRunner((input) =>
          Promise.resolve({
            rawReview: {},
            startedAt: input.now(),
            completedAt: input.now(),
          }),
        ),
        outcome: "UNKNOWN",
      },
      {
        id: "infra",
        runner: new FakeModelRunner(() =>
          Promise.reject(
            new ProductError("EXECUTOR_UNAVAILABLE", "Docker unavailable", {
              category: "INFRASTRUCTURE",
              retryable: true,
            }),
          ),
        ),
        outcome: "INFRASTRUCTURE_FAILURE",
      },
    ] as const;

    for (const item of cases) {
      const service = new VerificationService({
        dataRoot: path.join(root, item.id),
        runner: item.runner,
      });
      const created = await service.createRun({ archivePath, runId: `run_${item.id}` });
      expect((await service.waitForTerminal(created.runId)).outcome).toBe(item.outcome);
    }
  });

  it("cancels an active model run and releases it as CANCELLED", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "intentbench-service-"));
    roots.push(root);
    const archivePath = await setupArchive(root);
    const runner = new FakeModelRunner(
      async (input) =>
        await new Promise((_resolve, reject) => {
          input.signal.addEventListener(
            "abort",
            () => reject(new DOMException("cancelled", "AbortError")),
            { once: true },
          );
        }),
    );
    const service = new VerificationService({ dataRoot: path.join(root, "data"), runner });
    const created = await service.createRun({ archivePath });
    await service.waitForStatus(created.runId, "REVIEWING");

    await service.cancel(created.runId);

    expect(await service.waitForTerminal(created.runId)).toMatchObject({
      status: "CANCELLED",
      outcome: "CANCELLED",
    });
  });

  it("recovers a persisted nonterminal run as retryable infrastructure failure", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "intentbench-service-"));
    roots.push(root);
    const dataRoot = path.join(root, "data");
    const store = new FileRunStore(path.join(dataRoot, "runs"));
    await store.create(
      createVerificationRun({
        runId: "run_interrupted",
        snapshotId: `sha256:${"a".repeat(64)}`,
        createdAt: "2026-10-09T12:00:00.000Z",
      }),
    );
    const service = new VerificationService({
      dataRoot,
      runner: new FakeModelRunner(() => Promise.reject(new Error("must not execute"))),
      now: () => "2026-10-09T12:00:01.000Z",
    });

    await service.initialize();

    expect(await service.getStatus("run_interrupted")).toMatchObject({
      status: "FAILED",
      outcome: "INFRASTRUCTURE_FAILURE",
      error: { code: "EXECUTOR_UNAVAILABLE", retryable: true },
    });
  });

  it("cancels active isolated work during service shutdown", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "intentbench-service-"));
    roots.push(root);
    const archivePath = await setupArchive(root);
    const service = new VerificationService({
      dataRoot: path.join(root, "data"),
      runner: new FakeModelRunner(
        async (input) =>
          await new Promise((_resolve, reject) => {
            input.signal.addEventListener(
              "abort",
              () => reject(new DOMException("shutdown", "AbortError")),
              { once: true },
            );
          }),
      ),
    });
    const created = await service.createRun({ archivePath });
    await service.waitForStatus(created.runId, "REVIEWING");

    await service.shutdown();

    expect(await service.getStatus(created.runId)).toMatchObject({
      status: "CANCELLED",
      outcome: "CANCELLED",
    });
    await expect(service.createRun({ archivePath })).rejects.toMatchObject({
      code: "EXECUTOR_UNAVAILABLE",
    });
  });
});
