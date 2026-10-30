import { mkdtemp, rm, chmod, writeFile, cp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { VerificationService } from "../src/service.js";
import { ProductLibrary } from "../src/product-library.js";
import { FakeModelRunner, supportingReview, writeFixtureZip } from "./test-support.js";
import { removeTestDirectory } from "../../product-core/test/temp-cleanup.js";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await removeTestDirectory(root);
});

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "intentbench-library-"));
  roots.push(root);
  const service = new VerificationService({
    dataRoot: path.join(root, "data"),
    runner: new FakeModelRunner((input) =>
      Promise.resolve({
        rawReview: supportingReview(),
        startedAt: input.now(),
        completedAt: input.now(),
      }),
    ),
  });
  const archive = path.join(root, "input.zip");
  await writeFixtureZip(
    path.resolve("packages/product-service/test/fixtures/synthetic-counter"),
    archive,
  );
  const library = new ProductLibrary(service);
  return { root, service, archive, library };
}

it("lists only persisted runs and previews hash-verified source without executing it", async () => {
  const { service, archive, library } = await fixture();
  expect((await library.history()).runs).toEqual([]);
  const run = await service.createRun({ archivePath: archive });
  await service.waitForTerminal(run.runId);
  expect((await library.history()).runs[0]?.outcome).toBe("COMPLETE");
  const snapshot = await library.snapshot(run.runId);
  expect(snapshot.files).toHaveLength(4);
  const source = await library.source(run.runId, "src/counter.ts");
  expect(source.content).toContain("export");
  expect(source.sha256).toBe(
    snapshot.files.find((f) => f.relativePath === "src/counter.ts")?.sha256,
  );
  await expect(library.source(run.runId, "../manifest.json")).rejects.toThrow();
  await expect(library.source(run.runId, "src\\counter.ts")).rejects.toThrow();
  await expect(library.source(run.runId, "absent.ts")).rejects.toThrow();
});

it("rejects snapshot tampering rather than presenting changed bytes as immutable source", async () => {
  const { root, service, archive, library } = await fixture();
  const run = await service.createRun({ archivePath: archive });
  await service.waitForTerminal(run.runId);
  const target = path.join(
    root,
    "data",
    "snapshots",
    run.snapshotId.slice(7),
    "candidate",
    "src",
    "counter.ts",
  );
  await chmod(target, 0o644);
  await writeFile(target, "tampered");
  await expect(library.source(run.runId, "src/counter.ts")).rejects.toThrow();
});

it("keeps unavailable executor diagnostics separate from verification judgments", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "intentbench-diagnostic-"));
  roots.push(root);
  const service = new VerificationService({
    dataRoot: root,
    runner: {
      verifyAvailable: () => Promise.reject(new Error("unavailable private runtime detail")),
      run: () => Promise.reject(new Error("must never run")),
    },
  });
  const result = await service.checkExecutor();
  expect(result.available).toBe(false);
  expect(JSON.stringify(result)).not.toContain("private runtime detail");
  expect(await service.runStore.listRunIds()).toEqual([]);
});

it.each([Buffer.from([0, 255, 0]), Buffer.alloc(256 * 1024 + 1, 65)])(
  "refuses binary or oversized source previews without executing or altering the snapshot",
  async (bytes) => {
    const { root, service, archive, library } = await fixture();
    const seed = path.join(root, "new-synthetic-seed");
    await cp(path.resolve("packages/product-service/test/fixtures/synthetic-counter"), seed, {
      recursive: true,
    });
    await writeFile(path.join(seed, "src/counter.ts"), bytes);
    await rm(archive);
    await writeFixtureZip(seed, archive);
    const run = await service.createRun({ archivePath: archive });
    await service.waitForTerminal(run.runId);
    await expect(library.source(run.runId, "src/counter.ts")).rejects.toMatchObject({
      code: "ARCHIVE_ENTRY_UNSUPPORTED",
    });
    expect(
      (await library.snapshot(run.runId)).files.find(
        (file) => file.relativePath === "src/counter.ts",
      )?.size,
    ).toBe(bytes.length);
  },
);
