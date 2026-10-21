import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { hashInventory, walkRegularFiles } from "../../benchmark/src/inventory.js";
import { intakeRepositoryArchive, verifyCandidateSnapshot } from "../src/archive.js";
import { fixtureEntries, writeZip } from "./zip-test-helper.js";

const temporaryRoots: string[] = [];

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "intentbench-product-archive-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("repository archive intake", () => {
  it("creates the same immutable snapshot for equivalent archives", async () => {
    const root = await tempRoot();
    const fixtureRoot = path.resolve("packages/product-core/test/fixtures/synthetic-notes");
    const entries = await fixtureEntries(fixtureRoot);
    const firstArchive = path.join(root, "first.zip");
    const secondArchive = path.join(root, "second.zip");
    await writeZip(firstArchive, entries);
    await writeZip(secondArchive, [...entries].reverse());

    const first = await intakeRepositoryArchive({
      archivePath: firstArchive,
      snapshotsRoot: path.join(root, "snapshots"),
      createdAt: "2026-10-09T12:00:00.000Z",
    });
    const second = await intakeRepositoryArchive({
      archivePath: secondArchive,
      snapshotsRoot: path.join(root, "snapshots"),
      createdAt: "2026-10-09T12:01:00.000Z",
    });

    expect(second.snapshotId).toBe(first.snapshotId);
    expect(second.contentHash).toBe(first.contentHash);
    expect(first.specPath).toBe("SPEC.md");
    expect(first.fileCount).toBe(4);
    expect(await readFile(path.join(first.candidatePath, "SPEC.md"), "utf8")).toContain(
      "Synthetic Notes Formatter",
    );
    await expect(verifyCandidateSnapshot(first)).resolves.toEqual(first);
  });

  it("rejects normalized path collisions before publishing a snapshot", async () => {
    const root = await tempRoot();
    const archivePath = path.join(root, "collision.zip");
    await writeZip(archivePath, [
      { path: "SPEC.md", bytes: "# Spec" },
      { path: "src/value.ts", bytes: "export const value = 1;" },
      { path: "SRC/VALUE.ts", bytes: "export const value = 2;" },
    ]);

    await expect(
      intakeRepositoryArchive({ archivePath, snapshotsRoot: path.join(root, "snapshots") }),
    ).rejects.toMatchObject({ code: "ARCHIVE_PATH_UNSAFE" });
  });

  it("rejects links and unsupported archive entry types", async () => {
    const root = await tempRoot();
    const archivePath = path.join(root, "link.zip");
    await writeZip(archivePath, [
      { path: "SPEC.md", bytes: "# Spec" },
      { path: "src/link.ts", bytes: "target.ts", mode: 0o120777 },
    ]);

    await expect(
      intakeRepositoryArchive({ archivePath, snapshotsRoot: path.join(root, "snapshots") }),
    ).rejects.toMatchObject({ code: "ARCHIVE_ENTRY_UNSUPPORTED" });
  });

  it("enforces compressed and expanded archive limits", async () => {
    const root = await tempRoot();
    const archivePath = path.join(root, "oversized.zip");
    await writeZip(archivePath, [
      { path: "SPEC.md", bytes: "# Spec" },
      { path: "src/large.ts", bytes: "x".repeat(4096) },
    ]);

    await expect(
      intakeRepositoryArchive({
        archivePath,
        snapshotsRoot: path.join(root, "snapshots"),
        limits: { maxExpandedBytes: 1024 },
      }),
    ).rejects.toMatchObject({ code: "ARCHIVE_LIMIT_EXCEEDED" });
  });

  it("detects snapshot tampering instead of trusting stored metadata", async () => {
    const root = await tempRoot();
    const fixtureRoot = path.resolve("packages/product-core/test/fixtures/synthetic-notes");
    const archivePath = path.join(root, "candidate.zip");
    await writeZip(archivePath, await fixtureEntries(fixtureRoot));
    const snapshot = await intakeRepositoryArchive({
      archivePath,
      snapshotsRoot: path.join(root, "snapshots"),
    });
    const sourcePath = path.join(snapshot.candidatePath, "src", "normalize-tags.ts");
    await chmod(sourcePath, 0o644);
    await writeFile(sourcePath, "export const compromised = true;\n", "utf8");

    await expect(verifyCandidateSnapshot(snapshot)).rejects.toMatchObject({
      code: "SNAPSHOT_INTEGRITY",
    });
  });

  it("binds a published manifest to its content-addressed directory", async () => {
    const root = await tempRoot();
    const fixtureRoot = path.resolve("packages/product-core/test/fixtures/synthetic-notes");
    const archivePath = path.join(root, "candidate.zip");
    await writeZip(archivePath, await fixtureEntries(fixtureRoot));
    const snapshotsRoot = path.join(root, "snapshots");
    const snapshot = await intakeRepositoryArchive({ archivePath, snapshotsRoot });
    const sourcePath = path.join(snapshot.candidatePath, "src", "normalize-tags.ts");
    await chmod(sourcePath, 0o644);
    await writeFile(sourcePath, "export const compromised = true;\n", "utf8");
    const files = await walkRegularFiles(snapshot.candidatePath);
    const forgedHash = hashInventory(files);
    const forgedManifest = {
      ...snapshot,
      snapshotId: `sha256:${forgedHash}`,
      contentHash: forgedHash,
      fileCount: files.length,
      totalBytes: files.reduce((sum, file) => sum + file.size, 0),
      files,
      candidatePath: undefined,
      manifestPath: undefined,
    };
    await chmod(snapshot.manifestPath, 0o644);
    await writeFile(snapshot.manifestPath, `${JSON.stringify(forgedManifest, null, 2)}\n`, "utf8");

    await expect(intakeRepositoryArchive({ archivePath, snapshotsRoot })).rejects.toMatchObject({
      code: "SNAPSHOT_INTEGRITY",
    });
  });

  it("binds the selected specification path into the snapshot identity", async () => {
    const root = await tempRoot();
    const fixtureRoot = path.resolve("packages/product-core/test/fixtures/synthetic-notes");
    const archivePath = path.join(root, "candidate.zip");
    await writeZip(archivePath, await fixtureEntries(fixtureRoot));
    const snapshotsRoot = path.join(root, "snapshots");
    const snapshot = await intakeRepositoryArchive({ archivePath, snapshotsRoot });
    const manifest = JSON.parse(await readFile(snapshot.manifestPath, "utf8")) as Record<
      string,
      unknown
    >;
    manifest.specPath = "package.json";
    await chmod(snapshot.manifestPath, 0o644);
    await writeFile(snapshot.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    await expect(intakeRepositoryArchive({ archivePath, snapshotsRoot })).rejects.toMatchObject({
      code: "SNAPSHOT_INTEGRITY",
    });
  });
});
