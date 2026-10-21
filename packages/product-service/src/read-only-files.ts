import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { assertContained, validateRelativePath } from "../../benchmark/src/path-safety.js";
import { ProductError } from "../../product-core/src/index.js";

/** Read data, never execute it. Reject links, oversized reads and changed evidence. */
export async function readVerifiedFile(
  root: string,
  relativePath: string,
  maxBytes: number,
  digest?: string,
  canonicalText = false,
): Promise<Buffer> {
  try {
    if (relativePath.includes("\\")) throw new Error("noncanonical path");
    const safe = validateRelativePath(relativePath);
    const target = path.resolve(root, safe);
    assertContained(root, target);
    const physical = await realpath(target);
    assertContained(await realpath(root), physical);
    if (path.relative(target, physical) !== "") throw new Error("linked ancestor");
    const stats = await lstat(target);
    if (!stats.isFile() || stats.isSymbolicLink() || stats.nlink !== 1 || stats.size > maxBytes)
      throw new Error("unsupported file");
    const file = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const opened = await file.stat();
      if (
        !opened.isFile() ||
        opened.nlink !== 1 ||
        opened.size > maxBytes ||
        opened.ino !== stats.ino
      )
        throw new Error("file changed");
      const buffer = Buffer.alloc(opened.size + 1);
      let bytesRead = 0;
      while (bytesRead < buffer.length) {
        const next = await file.read(buffer, bytesRead, buffer.length - bytesRead, bytesRead);
        if (next.bytesRead === 0) break;
        bytesRead += next.bytesRead;
      }
      if (bytesRead > maxBytes || bytesRead !== opened.size) throw new Error("file changed");
      const bytes = buffer.subarray(0, bytesRead);
      const hashedBytes = canonicalText
        ? Buffer.from(bytes.toString("utf8").replaceAll("\r\n", "\n"))
        : bytes;
      if (digest && createHash("sha256").update(hashedBytes).digest("hex") !== digest)
        throw new Error("digest mismatch");
      return bytes;
    } finally {
      await file.close();
    }
  } catch (error) {
    throw new ProductError(
      "SNAPSHOT_INTEGRITY",
      "The requested file is unavailable, unsupported, or failed its integrity check.",
      { category: "SECURITY", cause: error },
    );
  }
}
