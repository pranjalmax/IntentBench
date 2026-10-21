import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  assertNoNormalizedPathCollisions,
  hashInventory,
  walkRegularFiles,
} from "../src/inventory.js";

const temporaryRoots: string[] = [];

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "intentbench-inventory-test-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("walkRegularFiles", () => {
  it("returns a sorted byte-accurate inventory with stable hashes", async () => {
    const root = await makeRoot();
    await mkdir(path.join(root, "src"));
    await writeFile(path.join(root, "z.txt"), "last", "utf8");
    await writeFile(path.join(root, "src", "a.txt"), "first", "utf8");

    const first = await walkRegularFiles(root);
    const second = await walkRegularFiles(root);

    expect(first.map((entry) => entry.relativePath)).toEqual(["src/a.txt", "z.txt"]);
    expect(first.map((entry) => entry.size)).toEqual([5, 4]);
    expect(hashInventory(first)).toMatch(/^[a-f0-9]{64}$/u);
    expect(hashInventory(first)).toBe(hashInventory(second));
  });

  it("rejects case-normalization collisions", () => {
    expect(() => assertNoNormalizedPathCollisions(["Alpha.txt", "alpha.txt"])).toThrow(
      "Normalized path collision: Alpha.txt and alpha.txt",
    );
  });

  it("rejects Unicode-normalization collisions", () => {
    expect(() => assertNoNormalizedPathCollisions(["caf\u00e9.txt", "cafe\u0301.txt"])).toThrow(
      "Normalized path collision: caf\u00e9.txt and cafe\u0301.txt",
    );
  });

  it("enforces file count and byte limits", async () => {
    const root = await makeRoot();
    await writeFile(path.join(root, "a.txt"), "1234", "utf8");
    await writeFile(path.join(root, "b.txt"), "5678", "utf8");

    await expect(walkRegularFiles(root, { maxFiles: 1 })).rejects.toThrow(/file count/iu);
    await expect(walkRegularFiles(root, { maxBytes: 7 })).rejects.toThrow(/byte/iu);
  });

  it("rejects symbolic links when the platform permits creating one", async () => {
    const root = await makeRoot();
    const target = path.join(root, "target.txt");
    await writeFile(target, "private", "utf8");
    try {
      await symlink(target, path.join(root, "bridge.txt"), "file");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EPERM" || code === "EACCES") return;
      throw error;
    }

    await expect(walkRegularFiles(root)).rejects.toThrow(/link|regular file/iu);
  });

  it("rejects a symbolic link or junction used as the inventory root", async () => {
    const parent = await makeRoot();
    const actualRoot = path.join(parent, "actual");
    const linkedRoot = path.join(parent, "linked");
    await mkdir(actualRoot);
    await writeFile(path.join(actualRoot, "private.txt"), "private", "utf8");
    try {
      await symlink(actualRoot, linkedRoot, process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EPERM" || code === "EACCES") return;
      throw error;
    }

    await expect(walkRegularFiles(linkedRoot)).rejects.toThrow(/root|link/iu);
  });
});
