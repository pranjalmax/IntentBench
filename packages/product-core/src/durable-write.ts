import { randomUUID } from "node:crypto";
import { link, mkdir, open, rm } from "node:fs/promises";
import path from "node:path";

export async function durableCreateText(
  target: string,
  value: string,
  mode = 0o600,
): Promise<void> {
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = path.join(
    path.dirname(target),
    `.${path.basename(target)}.${randomUUID()}.tmp`,
  );
  const handle = await open(temporary, "wx", mode);
  try {
    await handle.writeFile(value, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await link(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function durableCreateJson(target: string, value: unknown): Promise<void> {
  await durableCreateText(target, `${JSON.stringify(value, null, 2)}\n`);
}
