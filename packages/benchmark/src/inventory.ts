import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { assertContained, validateRelativePath } from "./path-safety.js";

export interface InventoryLimits {
  maxFiles?: number;
  maxBytes?: number;
  maxDepth?: number;
}

export interface FileInventoryEntry {
  relativePath: string;
  size: number;
  sha256: string;
}

const defaultLimits: Required<InventoryLimits> = {
  maxFiles: 2_000,
  maxBytes: 25 * 1024 * 1024,
  maxDepth: 24,
};

export function assertNoNormalizedPathCollisions(paths: readonly string[]): void {
  const normalizedNames = new Map<string, string>();
  for (const portablePath of paths) {
    const collisionKey = portablePath.normalize("NFC").toLocaleLowerCase("en-US");
    const previous = normalizedNames.get(collisionKey);
    if (previous !== undefined) {
      throw new Error(`Normalized path collision: ${previous} and ${portablePath}`);
    }
    normalizedNames.set(collisionKey, portablePath);
  }
}

export async function walkRegularFiles(
  root: string,
  limits: InventoryLimits = {},
): Promise<FileInventoryEntry[]> {
  const resolvedRoot = path.resolve(root);
  const effective = { ...defaultLimits, ...limits };
  const entries: FileInventoryEntry[] = [];
  const portablePaths: string[] = [];
  let totalBytes = 0;

  const rootStats = await lstat(resolvedRoot);
  if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
    throw new Error(`Inventory root must be a real directory, not a link: ${resolvedRoot}`);
  }

  async function visit(directory: string, depth: number): Promise<void> {
    if (depth > effective.maxDepth)
      throw new Error(`Inventory depth exceeds ${String(effective.maxDepth)}`);
    assertContained(resolvedRoot, directory);
    const children = (await readdir(directory)).sort((left, right) =>
      left.localeCompare(right, "en"),
    );
    for (const name of children) {
      const absolutePath = path.join(directory, name);
      assertContained(resolvedRoot, absolutePath);
      const stats = await lstat(absolutePath);
      if (stats.isSymbolicLink()) throw new Error(`Symbolic links are forbidden: ${absolutePath}`);
      if (stats.isDirectory()) {
        await visit(absolutePath, depth + 1);
        continue;
      }
      if (!stats.isFile()) throw new Error(`Only regular files are allowed: ${absolutePath}`);
      if (stats.nlink > 1) throw new Error(`Multiply linked files are forbidden: ${absolutePath}`);

      if (stats.size > effective.maxBytes - totalBytes) {
        throw new Error(`Inventory byte limit exceeds ${String(effective.maxBytes)}`);
      }

      const portablePath = validateRelativePath(path.relative(resolvedRoot, absolutePath));
      portablePaths.push(portablePath);
      assertNoNormalizedPathCollisions(portablePaths);

      const bytes = await readFile(absolutePath);
      totalBytes += bytes.byteLength;
      if (totalBytes > effective.maxBytes)
        throw new Error(`Inventory byte limit exceeds ${String(effective.maxBytes)}`);
      entries.push({
        relativePath: portablePath,
        size: bytes.byteLength,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
      if (entries.length > effective.maxFiles) {
        throw new Error(`Inventory file count exceeds ${String(effective.maxFiles)}`);
      }
    }
  }

  await visit(resolvedRoot, 0);
  return entries.sort((left, right) => left.relativePath.localeCompare(right.relativePath, "en"));
}

export function hashInventory(entries: readonly FileInventoryEntry[]): string {
  const hash = createHash("sha256");
  for (const entry of entries) {
    hash.update(entry.relativePath, "utf8");
    hash.update("\0");
    hash.update(String(entry.size), "utf8");
    hash.update("\0");
    hash.update(entry.sha256, "ascii");
    hash.update("\n");
  }
  return hash.digest("hex");
}
