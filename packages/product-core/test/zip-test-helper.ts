import { createWriteStream } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import yazl from "yazl";

export interface ZipEntryFixture {
  path: string;
  bytes: string | Buffer;
  mode?: number;
}

export async function writeZip(target: string, entries: readonly ZipEntryFixture[]): Promise<void> {
  await mkdir(path.dirname(target), { recursive: true });
  const zip = new yazl.ZipFile();
  for (const entry of entries) {
    const options = entry.mode === undefined ? {} : { mode: entry.mode };
    zip.addBuffer(
      Buffer.isBuffer(entry.bytes) ? entry.bytes : Buffer.from(entry.bytes),
      entry.path,
      options,
    );
  }
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(target, { flags: "wx" });
    output.on("close", resolve);
    output.on("error", reject);
    zip.outputStream.on("error", reject).pipe(output);
    zip.end();
  });
}

export async function fixtureEntries(root: string): Promise<ZipEntryFixture[]> {
  const relativePaths = ["SPEC.md", "package.json", "src/normalize-tags.ts", "tests/visible.ts"];
  return await Promise.all(
    relativePaths.map(async (relativePath) => ({
      path: relativePath,
      bytes: await readFile(path.join(root, relativePath)),
    })),
  );
}
