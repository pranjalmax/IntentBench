import {
  chmod,
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { expect, it } from "vitest";

import { removeTestDirectory } from "./temp-cleanup.js";

it("removes nested immutable snapshot directories and read-only files", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "intentbench-cleanup-"));
  const nested = path.join(root, "snapshots", "digest", "candidate", "src");
  const file = path.join(nested, "source.ts");
  await mkdir(nested, { recursive: true });
  await writeFile(file, "export const value = 1;\n");
  await chmod(file, 0o444);
  const directories = [nested, path.dirname(nested), path.dirname(path.dirname(nested))];
  for (const directory of directories) await chmod(directory, 0o555);
  try {
    await removeTestDirectory(root);
    await expect(lstat(root)).rejects.toMatchObject({ code: "ENOENT" });
    // Teardown remains safe when repeated after an already-removed fixture.
    await removeTestDirectory(root);
  } finally {
    for (const directory of [...directories].reverse()) {
      await chmod(directory, 0o700).catch((error: unknown) => {
        if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
      });
    }
    await chmod(file, 0o600).catch((error: unknown) => {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    });
    await rm(root, { recursive: true, force: true });
  }
});

it("refuses paths outside a direct IntentBench temporary root", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "other-cleanup-"));
  const sentinel = path.join(root, "keep.txt");
  await writeFile(sentinel, "keep");
  try {
    await expect(removeTestDirectory(root)).rejects.toThrow("temporary test root");
    await expect(removeTestDirectory(os.tmpdir())).rejects.toThrow("temporary test root");
    await expect(removeTestDirectory(path.join(root, "intentbench-nested"))).rejects.toThrow(
      "temporary test root",
    );
    expect(await readFile(sentinel, "utf8")).toBe("keep");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("does not follow directory links or change their targets", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "intentbench-cleanup-"));
  const outside = await mkdtemp(path.join(os.tmpdir(), "intentbench-sentinel-"));
  const sentinel = path.join(outside, "keep.txt");
  await writeFile(sentinel, "keep");
  await chmod(sentinel, 0o444);
  const originalMode = (await lstat(sentinel)).mode;
  try {
    await symlink(
      outside,
      path.join(root, "linked"),
      process.platform === "win32" ? "junction" : "dir",
    );
    await removeTestDirectory(root);
    expect(await readFile(sentinel, "utf8")).toBe("keep");
    expect((await lstat(sentinel)).mode).toBe(originalMode);
  } finally {
    await chmod(sentinel, 0o600);
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

it("refuses a linked temporary root without changing the target", async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), "intentbench-link-test-"));
  const alias = `${parent}-alias`;
  const sentinel = path.join(parent, "keep.txt");
  await writeFile(sentinel, "keep");
  try {
    await symlink(parent, alias, process.platform === "win32" ? "junction" : "dir");
    await expect(removeTestDirectory(alias)).rejects.toThrow("directory link");
    expect(await readFile(sentinel, "utf8")).toBe("keep");
  } finally {
    await rm(alias, { force: true, recursive: true });
    await rm(parent, { force: true, recursive: true });
  }
});

it("does not change permissions through a hard link", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "intentbench-cleanup-"));
  const outside = await mkdtemp(path.join(os.tmpdir(), "intentbench-sentinel-"));
  const sentinel = path.join(outside, "keep.txt");
  await writeFile(sentinel, "keep");
  const originalMode = (await lstat(sentinel)).mode;
  try {
    await link(sentinel, path.join(root, "linked.txt"));
    await removeTestDirectory(root);
    expect(await readFile(sentinel, "utf8")).toBe("keep");
    expect((await lstat(sentinel)).mode).toBe(originalMode);
    expect((await lstat(sentinel)).nlink).toBe(1);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});
