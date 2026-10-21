import { createWriteStream } from "node:fs";
import { chmod, lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

import yauzl, { type Entry } from "yauzl";

import {
  assertNoNormalizedPathCollisions,
  hashInventory,
  walkRegularFiles,
  type InventoryLimits,
} from "../../benchmark/src/inventory.js";
import { assertContained, validateRelativePath } from "../../benchmark/src/path-safety.js";
import { ProductError, isProductError } from "./errors.js";
import {
  createCandidateSnapshotId,
  parseCandidateSnapshotManifest,
  productSchemaVersion,
  type CandidateSnapshot,
  type CandidateSnapshotManifest,
} from "./schemas.js";

export interface ArchiveIntakeLimits {
  maxArchiveBytes?: number;
  maxEntries?: number;
  maxExpandedBytes?: number;
  maxFileBytes?: number;
  maxDepth?: number;
}

export interface ArchiveIntakeOptions {
  archivePath: string;
  snapshotsRoot: string;
  specPath?: string;
  createdAt?: string;
  limits?: ArchiveIntakeLimits;
}

const defaultLimits: Required<ArchiveIntakeLimits> = {
  maxArchiveBytes: 10 * 1024 * 1024,
  maxEntries: 2_000,
  maxExpandedBytes: 25 * 1024 * 1024,
  maxFileBytes: 5 * 1024 * 1024,
  maxDepth: 24,
};

const forbiddenSegments = new Set([
  ".git",
  ".intentbench-auth",
  ".intentbench-oracles",
  ".intentbench-tmp",
  "node_modules",
]);

function productError(
  code: ConstructorParameters<typeof ProductError>[0],
  message: string,
  category: ConstructorParameters<typeof ProductError>[2]["category"],
  cause?: unknown,
): ProductError {
  return new ProductError(code, message, { category, cause });
}

function repositoryPath(entryName: string, maxDepth: number): string {
  let relativePath: string;
  try {
    relativePath = validateRelativePath(entryName);
  } catch (error) {
    throw productError(
      "ARCHIVE_PATH_UNSAFE",
      `unsafe archive path: ${entryName}`,
      "SECURITY",
      error,
    );
  }
  const segments = relativePath.split("/");
  if (segments.length > maxDepth) {
    throw productError("ARCHIVE_LIMIT_EXCEEDED", "archive path depth exceeds the limit", "INPUT");
  }
  const lower = segments.map((segment) => segment.toLocaleLowerCase("en-US"));
  if (lower.some((segment) => forbiddenSegments.has(segment))) {
    throw productError(
      "ARCHIVE_SENSITIVE_CONTENT",
      `archive contains a forbidden repository path: ${relativePath}`,
      "SECURITY",
    );
  }
  const filename = lower.at(-1) ?? "";
  if (filename === ".env" || (filename.startsWith(".env.") && filename !== ".env.example")) {
    throw productError(
      "ARCHIVE_SENSITIVE_CONTENT",
      `archive contains an environment secret file: ${relativePath}`,
      "SECURITY",
    );
  }
  return relativePath;
}

function unixFileType(entry: Entry): number {
  return (entry.externalFileAttributes >>> 16) & 0o170000;
}

function assertSupportedEntry(entry: Entry, isDirectory: boolean): void {
  if (entry.isEncrypted()) {
    throw productError(
      "ARCHIVE_ENTRY_UNSUPPORTED",
      "encrypted ZIP entries are not supported",
      "INPUT",
    );
  }
  if (!entry.canDecodeFileData()) {
    throw productError(
      "ARCHIVE_ENTRY_UNSUPPORTED",
      `unsupported ZIP compression method: ${String(entry.compressionMethod)}`,
      "INPUT",
    );
  }
  const fileType = unixFileType(entry);
  if (fileType !== 0 && fileType !== 0o100000 && !(isDirectory && fileType === 0o040000)) {
    throw productError(
      "ARCHIVE_ENTRY_UNSUPPORTED",
      `archive entry is not a regular file or directory: ${entry.fileName}`,
      "SECURITY",
    );
  }
}

async function setCandidateReadOnly(candidatePath: string): Promise<void> {
  const inventory = await walkRegularFiles(candidatePath);
  for (const entry of inventory) {
    await chmod(path.join(candidatePath, entry.relativePath), 0o444);
  }
  const directories = new Set<string>([candidatePath]);
  for (const entry of inventory) {
    let directory = path.dirname(path.join(candidatePath, entry.relativePath));
    while (directory !== candidatePath && directory.startsWith(`${candidatePath}${path.sep}`)) {
      directories.add(directory);
      directory = path.dirname(directory);
    }
  }
  for (const directory of [...directories].sort((left, right) => right.length - left.length)) {
    await chmod(directory, 0o555);
  }
}

function withPaths(manifest: CandidateSnapshotManifest, snapshotRoot: string): CandidateSnapshot {
  return {
    ...manifest,
    candidatePath: path.join(snapshotRoot, "candidate"),
    manifestPath: path.join(snapshotRoot, "manifest.json"),
  };
}

async function readPublishedSnapshot(snapshotRoot: string): Promise<CandidateSnapshot> {
  let manifest: CandidateSnapshotManifest;
  try {
    manifest = parseCandidateSnapshotManifest(
      JSON.parse(await readFile(path.join(snapshotRoot, "manifest.json"), "utf8")) as unknown,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw error;
    if (isProductError(error)) throw error;
    throw productError(
      "SNAPSHOT_INTEGRITY",
      "published snapshot manifest is invalid",
      "SECURITY",
      error,
    );
  }
  if (manifest.snapshotId !== `sha256:${path.basename(snapshotRoot)}`) {
    throw productError(
      "SNAPSHOT_INTEGRITY",
      "snapshot manifest is not bound to its content-addressed directory",
      "SECURITY",
    );
  }
  return withPaths(manifest, snapshotRoot);
}

async function extractArchive(
  archivePath: string,
  candidatePath: string,
  limits: Required<ArchiveIntakeLimits>,
): Promise<void> {
  let zip: yauzl.ZipFile;
  try {
    zip = await yauzl.openPromise(archivePath, {
      autoClose: false,
      decodeStrings: true,
      strictFileNames: true,
      validateEntrySizes: true,
    });
  } catch (error) {
    throw productError(
      "ARCHIVE_INVALID",
      "repository archive is not a valid ZIP file",
      "INPUT",
      error,
    );
  }
  let expandedBytes = 0;
  let entryCount = 0;
  const paths: string[] = [];
  try {
    if (zip.entryCount > limits.maxEntries) {
      throw productError(
        "ARCHIVE_LIMIT_EXCEEDED",
        "archive entry count exceeds the limit",
        "INPUT",
      );
    }
    for await (const entry of zip.eachEntry()) {
      entryCount += 1;
      if (entryCount > limits.maxEntries) {
        throw productError(
          "ARCHIVE_LIMIT_EXCEEDED",
          "archive entry count exceeds the limit",
          "INPUT",
        );
      }
      const isDirectory = entry.fileName.endsWith("/");
      assertSupportedEntry(entry, isDirectory);
      if (isDirectory) continue;
      const relativePath = repositoryPath(entry.fileName, limits.maxDepth);
      paths.push(relativePath);
      try {
        assertNoNormalizedPathCollisions(paths);
      } catch (error) {
        throw productError(
          "ARCHIVE_PATH_UNSAFE",
          "archive contains colliding paths",
          "SECURITY",
          error,
        );
      }
      if (entry.uncompressedSize > limits.maxFileBytes) {
        throw productError(
          "ARCHIVE_LIMIT_EXCEEDED",
          `archive file exceeds the limit: ${relativePath}`,
          "INPUT",
        );
      }
      if (entry.uncompressedSize > limits.maxExpandedBytes - expandedBytes) {
        throw productError("ARCHIVE_LIMIT_EXCEEDED", "expanded archive exceeds the limit", "INPUT");
      }
      const destination = path.join(candidatePath, relativePath);
      assertContained(candidatePath, destination);
      await mkdir(path.dirname(destination), { recursive: true });
      const source = await zip.openReadStreamPromise(entry);
      let fileBytes = 0;
      const limiter = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          fileBytes += chunk.byteLength;
          if (
            fileBytes > limits.maxFileBytes ||
            expandedBytes + fileBytes > limits.maxExpandedBytes
          ) {
            callback(
              productError("ARCHIVE_LIMIT_EXCEEDED", "expanded archive exceeds the limit", "INPUT"),
            );
            return;
          }
          callback(null, chunk);
        },
      });
      await pipeline(source, limiter, createWriteStream(destination, { flags: "wx", mode: 0o600 }));
      expandedBytes += fileBytes;
    }
  } catch (error) {
    if (isProductError(error)) throw error;
    throw productError("ARCHIVE_INVALID", "repository archive extraction failed", "INPUT", error);
  } finally {
    zip.close();
  }
}

export async function intakeRepositoryArchive(
  options: ArchiveIntakeOptions,
): Promise<CandidateSnapshot> {
  const archivePath = path.resolve(options.archivePath);
  const snapshotsRoot = path.resolve(options.snapshotsRoot);
  const limits = { ...defaultLimits, ...options.limits };
  const specPath = repositoryPath(options.specPath ?? "SPEC.md", limits.maxDepth);
  let archiveStats;
  try {
    archiveStats = await lstat(archivePath);
  } catch (error) {
    throw productError("ARCHIVE_INVALID", "repository archive is unavailable", "INPUT", error);
  }
  if (!archiveStats.isFile() || archiveStats.isSymbolicLink() || archiveStats.nlink > 1) {
    throw productError(
      "ARCHIVE_INVALID",
      "repository archive must be one regular file",
      "SECURITY",
    );
  }
  if (archiveStats.size > limits.maxArchiveBytes) {
    throw productError("ARCHIVE_LIMIT_EXCEEDED", "compressed archive exceeds the limit", "INPUT");
  }

  await mkdir(snapshotsRoot, { recursive: true });
  const stagingRoot = await mkdtemp(path.join(snapshotsRoot, ".staging-"));
  const candidatePath = path.join(stagingRoot, "candidate");
  await mkdir(candidatePath);
  try {
    await extractArchive(archivePath, candidatePath, limits);
    try {
      const stats = await lstat(path.join(candidatePath, specPath));
      if (!stats.isFile() || stats.isSymbolicLink()) throw new Error("spec is not a regular file");
    } catch (error) {
      throw productError(
        "SPEC_MISSING",
        `required specification is missing: ${specPath}`,
        "INPUT",
        error,
      );
    }
    const inventoryLimits: InventoryLimits = {
      maxFiles: limits.maxEntries,
      maxBytes: limits.maxExpandedBytes,
      maxDepth: limits.maxDepth,
    };
    const files = await walkRegularFiles(candidatePath, inventoryLimits);
    const contentHash = hashInventory(files);
    const snapshotId = createCandidateSnapshotId(specPath, contentHash);
    const manifest: CandidateSnapshotManifest = {
      schemaVersion: productSchemaVersion,
      snapshotId,
      contentHash,
      createdAt: options.createdAt ?? new Date().toISOString(),
      specPath,
      fileCount: files.length,
      totalBytes: files.reduce((sum, file) => sum + file.size, 0),
      files,
    };
    const publishedRoot = path.join(snapshotsRoot, snapshotId.slice("sha256:".length));
    try {
      const existing = await readPublishedSnapshot(publishedRoot);
      await verifyCandidateSnapshot(existing);
      await rm(stagingRoot, { recursive: true, force: true });
      return existing;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        if (isProductError(error)) throw error;
        const manifestMissing = (error as NodeJS.ErrnoException).code === "ENOENT";
        if (!manifestMissing) throw error;
      }
    }
    await writeFile(
      path.join(stagingRoot, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      {
        encoding: "utf8",
        flag: "wx",
        mode: 0o444,
      },
    );
    await setCandidateReadOnly(candidatePath);
    try {
      await rename(stagingRoot, publishedRoot);
      await chmod(publishedRoot, 0o555);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      await rm(stagingRoot, { recursive: true, force: true });
    }
    const snapshot = await readPublishedSnapshot(publishedRoot);
    return await verifyCandidateSnapshot(snapshot);
  } catch (error) {
    await rm(stagingRoot, { recursive: true, force: true }).catch(() => undefined);
    if (isProductError(error)) throw error;
    throw productError("ARCHIVE_INVALID", "repository archive intake failed", "INPUT", error);
  }
}

export async function verifyCandidateSnapshot(
  snapshot: CandidateSnapshot,
): Promise<CandidateSnapshot> {
  const directoryHash = path.basename(path.dirname(snapshot.candidatePath));
  if (
    snapshot.snapshotId !== createCandidateSnapshotId(snapshot.specPath, snapshot.contentHash) ||
    snapshot.snapshotId !== `sha256:${directoryHash}`
  ) {
    throw productError(
      "SNAPSHOT_INTEGRITY",
      "candidate snapshot identity does not match its storage location",
      "SECURITY",
    );
  }
  let files;
  try {
    files = await walkRegularFiles(snapshot.candidatePath, {
      maxFiles: Math.max(snapshot.fileCount, 1),
      maxBytes: Math.max(snapshot.totalBytes, 1),
      maxDepth: defaultLimits.maxDepth,
    });
  } catch (error) {
    throw productError(
      "SNAPSHOT_INTEGRITY",
      "candidate snapshot cannot be inventoried",
      "SECURITY",
      error,
    );
  }
  const digest = hashInventory(files);
  if (digest !== snapshot.contentHash || JSON.stringify(files) !== JSON.stringify(snapshot.files)) {
    throw productError("SNAPSHOT_INTEGRITY", "candidate snapshot content hash changed", "SECURITY");
  }
  return snapshot;
}
