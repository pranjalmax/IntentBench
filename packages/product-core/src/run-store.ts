import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";

import { durableCreateJson } from "./durable-write.js";
import { ProductError } from "./errors.js";
import { parseVerificationRunRecord, type VerificationRunRecord } from "./schemas.js";

const runIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const revisionPattern = /^revision-(\d{8})\.json$/u;

function runDirectory(root: string, runId: string): string {
  if (!runIdPattern.test(runId)) {
    throw new ProductError("RUN_NOT_FOUND", "run identifier is invalid", { category: "STATE" });
  }
  return path.join(root, runId);
}

function revisionName(revision: number): string {
  if (!Number.isSafeInteger(revision) || revision < 0 || revision > 99_999_999) {
    throw new ProductError("RUN_STORE_CORRUPT", "run revision is outside the supported range", {
      category: "INTERNAL",
    });
  }
  return `revision-${String(revision).padStart(8, "0")}.json`;
}

function conflict(error: unknown, message: string): never {
  if ((error as NodeJS.ErrnoException | undefined)?.code === "EEXIST") {
    throw new ProductError("RUN_CONFLICT", message, {
      category: "STATE",
      retryable: true,
      cause: error,
    });
  }
  throw error;
}

function validatedRecord(record: VerificationRunRecord): VerificationRunRecord {
  try {
    return parseVerificationRunRecord(record);
  } catch (error) {
    throw new ProductError("RUN_STORE_CORRUPT", "run record violates the versioned contract", {
      category: "INTERNAL",
      cause: error,
    });
  }
}

export class FileRunStore {
  readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  async create(record: VerificationRunRecord): Promise<void> {
    const valid = validatedRecord(record);
    if (valid.revision !== 0 || valid.status !== "PENDING") {
      throw new ProductError("RUN_CONFLICT", "new run must start at revision zero", {
        category: "STATE",
      });
    }
    await mkdir(this.root, { recursive: true });
    const directory = runDirectory(this.root, record.runId);
    let createdDirectory = false;
    try {
      await mkdir(directory);
      createdDirectory = true;
      await durableCreateJson(path.join(directory, revisionName(0)), valid);
    } catch (error) {
      if (createdDirectory) {
        await rm(directory, { recursive: true, force: true }).catch(() => undefined);
      }
      conflict(error, `run already exists: ${record.runId}`);
    }
  }

  async append(record: VerificationRunRecord): Promise<void> {
    const valid = validatedRecord(record);
    const current = await this.read(valid.runId);
    if (
      valid.revision !== current.revision + 1 ||
      valid.snapshotId !== current.snapshotId ||
      valid.createdAt !== current.createdAt
    ) {
      throw new ProductError("RUN_CONFLICT", "run revision or immutable identity changed", {
        category: "STATE",
        retryable: true,
      });
    }
    const target = path.join(runDirectory(this.root, valid.runId), revisionName(valid.revision));
    try {
      await durableCreateJson(target, valid);
    } catch (error) {
      conflict(error, `run revision already exists: ${String(valid.revision)}`);
    }
  }

  async read(runId: string): Promise<VerificationRunRecord> {
    const history = await this.history(runId);
    const latest = history.at(-1);
    if (latest === undefined) {
      throw new ProductError("RUN_NOT_FOUND", `run not found: ${runId}`, { category: "STATE" });
    }
    return latest;
  }

  async history(runId: string): Promise<VerificationRunRecord[]> {
    const directory = runDirectory(this.root, runId);
    let names: string[];
    try {
      names = (await readdir(directory))
        .filter((name) => revisionPattern.test(name))
        .sort((left, right) => left.localeCompare(right, "en"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new ProductError("RUN_NOT_FOUND", `run not found: ${runId}`, {
          category: "STATE",
          cause: error,
        });
      }
      throw error;
    }
    const records: VerificationRunRecord[] = [];
    for (const [index, name] of names.entries()) {
      try {
        const record = parseVerificationRunRecord(
          JSON.parse(await readFile(path.join(directory, name), "utf8")) as unknown,
        );
        if (record.runId !== runId || record.revision !== index) {
          throw new TypeError("run revision sequence is invalid");
        }
        records.push(record);
      } catch (error) {
        throw new ProductError("RUN_STORE_CORRUPT", `stored run is corrupt: ${runId}/${name}`, {
          category: "INTERNAL",
          cause: error,
        });
      }
    }
    return records;
  }

  async listRunIds(): Promise<string[]> {
    try {
      const entries = await readdir(this.root, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory() && runIdPattern.test(entry.name))
        .map((entry) => entry.name)
        .sort((left, right) => left.localeCompare(right, "en"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
}
