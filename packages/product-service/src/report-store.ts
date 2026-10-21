import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  durableCreateJson,
  ProductError,
  type VerificationReport,
} from "../../product-core/src/index.js";

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

function target(root: string, runId: string): string {
  if (!identifierPattern.test(runId)) {
    throw new ProductError("RUN_NOT_FOUND", "run identifier is invalid", { category: "STATE" });
  }
  return path.join(root, `${runId}.json`);
}

function parseReport(value: unknown, runId: string): VerificationReport {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("report must be an object");
  }
  const report = value as Partial<VerificationReport>;
  if (
    report.schemaVersion !== "1.0.0" ||
    report.runId !== runId ||
    typeof report.reportId !== "string" ||
    !identifierPattern.test(report.reportId) ||
    typeof report.snapshotId !== "string" ||
    !/^sha256:[a-f0-9]{64}$/u.test(report.snapshotId) ||
    (report.verdict !== "COMPLETE" && report.verdict !== "INCOMPLETE") ||
    report.review?.verdict !== report.verdict
  ) {
    throw new TypeError("report contract is invalid");
  }
  return report as VerificationReport;
}

export class FileReportStore {
  readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  async create(report: VerificationReport): Promise<void> {
    try {
      await durableCreateJson(target(this.root, report.runId), parseReport(report, report.runId));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new ProductError("RUN_CONFLICT", "verification report already exists", {
          category: "STATE",
          cause: error,
        });
      }
      throw error;
    }
  }

  async read(runId: string): Promise<VerificationReport> {
    try {
      return parseReport(JSON.parse(await readFile(target(this.root, runId), "utf8")), runId);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new ProductError("RUN_NOT_FOUND", `report not found for run: ${runId}`, {
          category: "STATE",
          cause: error,
        });
      }
      if (error instanceof ProductError) throw error;
      throw new ProductError("RUN_STORE_CORRUPT", `stored report is corrupt: ${runId}`, {
        category: "INTERNAL",
        cause: error,
      });
    }
  }
}
