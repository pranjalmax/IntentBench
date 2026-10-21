import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, rm, symlink, link } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { afterEach, expect, it } from "vitest";
import { readVerifiedFile } from "../src/read-only-files.js";
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
it("bounds reads, checks hashes, and refuses traversal, links and non-regular files", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "intentbench-readonly-"));
  roots.push(root);
  const owned = path.join(root, "owned");
  await mkdir(owned);
  await writeFile(path.join(owned, "text.txt"), "<script>not executed</script>");
  await writeFile(path.join(root, "outside.txt"), "private canary");
  const bytes = await readVerifiedFile(owned, "text.txt", 100);
  expect(bytes.toString()).toContain("<script>");
  await expect(readVerifiedFile(owned, "text.txt", 2)).rejects.toThrow();
  await expect(readVerifiedFile(owned, "text.txt", 100, "0".repeat(64))).rejects.toThrow();
  expect(
    await readVerifiedFile(
      owned,
      "text.txt",
      100,
      createHash("sha256").update(bytes).digest("hex"),
    ),
  ).toEqual(bytes);
  for (const name of [
    "../outside.txt",
    "..\\outside.txt",
    "/outside.txt",
    "text.txt:stream",
    ".",
  ]) {
    await expect(readVerifiedFile(owned, name, 100)).rejects.toThrow();
  }
  await link(path.join(root, "outside.txt"), path.join(owned, "hardlink.txt"));
  await expect(readVerifiedFile(owned, "hardlink.txt", 100)).rejects.toThrow();
  await mkdir(path.join(root, "external"));
  await writeFile(path.join(root, "external", "secret.txt"), "secret");
  await symlink(path.join(root, "external"), path.join(owned, "junction"), "junction");
  await expect(readVerifiedFile(owned, "junction/secret.txt", 100)).rejects.toThrow();
  await expect(readVerifiedFile(owned, "junction", 100)).rejects.toThrow();
});

it("normalizes line endings only for explicitly canonical published research, not snapshot byte identity", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "intentbench-canonical-"));
  roots.push(root);
  await writeFile(path.join(root, "record.json"), '{\r\n  "value": 8\r\n}\r\n');
  const digest = createHash("sha256").update('{\n  "value": 8\n}\n').digest("hex");
  await expect(readVerifiedFile(root, "record.json", 100, digest)).rejects.toThrow();
  expect((await readVerifiedFile(root, "record.json", 100, digest, true)).toString()).toContain(
    "\r\n",
  );
  await writeFile(path.join(root, "record.json"), '{\r\n  "value": 12\r\n}\r\n');
  await expect(readVerifiedFile(root, "record.json", 100, digest, true)).rejects.toThrow();
});
