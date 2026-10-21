import path from "node:path";
import {
  parseCandidateSnapshotManifest,
  verifyCandidateSnapshot,
  ProductError,
} from "../../product-core/src/index.js";
import type { VerificationStatusView } from "./contracts.js";
import type { VerificationService } from "./service.js";
import { readVerifiedFile } from "./read-only-files.js";

export interface RunHistory {
  runs: VerificationStatusView[];
  warnings: string[];
}
export class ProductLibrary {
  constructor(private readonly service: VerificationService) {}
  async history(): Promise<RunHistory> {
    const runs: VerificationStatusView[] = [];
    const warnings: string[] = [];
    for (const id of await this.service.runStore.listRunIds()) {
      try {
        runs.push(await this.service.getStatus(id));
      } catch {
        warnings.push(`A persisted run could not be read: ${id}`);
      }
    }
    runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.runId.localeCompare(b.runId));
    return { runs, warnings };
  }
  async snapshot(runId: string) {
    const run = await this.service.getStatus(runId);
    const root = path.join(this.service.dataRoot, "snapshots", run.snapshotId.slice(7));
    const manifest = parseCandidateSnapshotManifest(
      JSON.parse(
        (await readVerifiedFile(root, "manifest.json", 1024 * 1024)).toString("utf8"),
      ) as unknown,
    );
    if (manifest.snapshotId !== run.snapshotId)
      throw new ProductError("SNAPSHOT_INTEGRITY", "Snapshot identity mismatch.", {
        category: "SECURITY",
      });
    await verifyCandidateSnapshot({
      ...manifest,
      candidatePath: path.join(root, "candidate"),
      manifestPath: path.join(root, "manifest.json"),
    });
    return manifest;
  }
  async source(runId: string, relativePath: string) {
    const snapshot = await this.snapshot(runId);
    const entry = snapshot.files.find((file) => file.relativePath === relativePath);
    if (!entry)
      throw new ProductError("ARCHIVE_PATH_UNSAFE", "Select a file in the snapshot inventory.", {
        category: "SECURITY",
      });
    if (entry.size > 256 * 1024)
      throw new ProductError(
        "ARCHIVE_ENTRY_UNSUPPORTED",
        "Preview supports UTF-8 text only, up to 256 KiB. Select another inventory file.",
        { category: "INPUT" },
      );
    const bytes = await readVerifiedFile(
      path.join(this.service.dataRoot, "snapshots", snapshot.snapshotId.slice(7), "candidate"),
      entry.relativePath,
      256 * 1024,
      entry.sha256,
    );
    let content: string;
    try {
      content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (content.includes("\0")) throw new Error("binary");
    } catch {
      throw new ProductError(
        "ARCHIVE_ENTRY_UNSUPPORTED",
        "Preview supports UTF-8 text only, up to 256 KiB.",
        { category: "INPUT" },
      );
    }
    return { relativePath: entry.relativePath, sha256: entry.sha256, size: entry.size, content };
  }
}
