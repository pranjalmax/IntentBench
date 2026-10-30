import { chmod, lstat, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Test teardown only: never import this into production snapshot handling.
export async function removeTestDirectory(root: string): Promise<void> {
  const resolved = path.resolve(root);
  if (
    path.dirname(resolved) !== path.resolve(os.tmpdir()) ||
    !path.basename(resolved).startsWith("intentbench-")
  ) {
    throw new Error("cleanup requires a direct IntentBench temporary test root");
  }
  const stats = await lstat(resolved).catch((error: unknown) => {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    return undefined;
  });
  if (!stats) return;
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new Error("cleanup refuses a directory link or non-directory root");
  }
  await restoreOwnerPermissions(resolved);
  await rm(resolved, { recursive: true, force: true });
}

async function restoreOwnerPermissions(entry: string): Promise<void> {
  const stats = await lstat(entry);
  if (stats.isSymbolicLink()) return;
  if (stats.isDirectory()) {
    // POSIX unlink/rmdir require write permission on the containing directory.
    await chmod(entry, 0o700);
    for (const name of await readdir(entry)) {
      await restoreOwnerPermissions(path.join(entry, name));
    }
  } else if (stats.isFile() && stats.nlink === 1) {
    // Windows also needs the read-only file attribute cleared before deletion.
    // Never chmod hard links: that would change the target outside this root.
    await chmod(entry, 0o600);
  }
}
