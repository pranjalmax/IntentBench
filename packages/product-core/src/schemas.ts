import { createHash } from "node:crypto";

import type { CalibratedReview } from "../../advanced-verifier/src/gate.js";
import type { FileInventoryEntry } from "../../benchmark/src/inventory.js";

import {
  productErrorCodes,
  type ProductErrorCategory,
  type ProductErrorCode,
  type ProductErrorData,
} from "./errors.js";

export const productSchemaVersion = "1.0.0" as const;
export const frozenA11ProfileId = "a1.1-frozen" as const;

export interface CandidateSnapshotManifest {
  schemaVersion: typeof productSchemaVersion;
  snapshotId: string;
  contentHash: string;
  createdAt: string;
  specPath: string;
  fileCount: number;
  totalBytes: number;
  files: FileInventoryEntry[];
}

export interface CandidateSnapshot extends CandidateSnapshotManifest {
  candidatePath: string;
  manifestPath: string;
}

export const verificationRunStatuses = [
  "PENDING",
  "REVIEWING",
  "CALIBRATING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
] as const;

export type VerificationRunStatus = (typeof verificationRunStatuses)[number];
export type VerificationVerdict = "COMPLETE" | "INCOMPLETE";

export interface VerificationRunRecord {
  schemaVersion: typeof productSchemaVersion;
  runId: string;
  snapshotId: string;
  verifierProfileId: typeof frozenA11ProfileId;
  status: VerificationRunStatus;
  revision: number;
  createdAt: string;
  updatedAt: string;
  verdict?: VerificationVerdict;
  reportId?: string;
  error?: ProductErrorData;
}

export interface FrozenVerifierIdentity {
  selectedIteration: "A1.1";
  promptHash: string;
  configHash: string;
  gateHash: string;
  protocolHash: string;
  implementationCommit: string;
}

export interface VerificationReport {
  schemaVersion: typeof productSchemaVersion;
  reportId: string;
  runId: string;
  snapshotId: string;
  generatedAt: string;
  verifier: FrozenVerifierIdentity;
  verdict: VerificationVerdict;
  review: CalibratedReview;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
): void {
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unexpected.length > 0) {
    throw new TypeError(`${label} has unexpected fields: ${unexpected.join(", ")}`);
  }
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} must be a nonempty string`);
  }
  return value;
}

function integer(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a nonnegative safe integer`);
  }
  return value;
}

function timestamp(value: unknown, label: string): string {
  const result = text(value, label);
  if (!Number.isFinite(Date.parse(result)))
    throw new TypeError(`${label} must be an ISO timestamp`);
  return result;
}

function sha256(value: unknown, label: string): string {
  const result = text(value, label);
  if (!/^[a-f0-9]{64}$/u.test(result)) throw new TypeError(`${label} must be a SHA-256 hex digest`);
  return result;
}

function snapshotId(value: unknown): string {
  const result = text(value, "snapshotId");
  if (!/^sha256:[a-f0-9]{64}$/u.test(result)) {
    throw new TypeError("snapshotId must be a sha256-prefixed digest");
  }
  return result;
}

export function createCandidateSnapshotId(specPath: string, contentHash: string): string {
  const validSpecPath = text(specPath, "specPath");
  const validContentHash = sha256(contentHash, "contentHash");
  const digest = createHash("sha256")
    .update("intentbench:candidate-snapshot:v1\0", "utf8")
    .update(validSpecPath, "utf8")
    .update("\0", "utf8")
    .update(validContentHash, "ascii")
    .digest("hex");
  return `sha256:${digest}`;
}

function parseInventory(value: unknown): FileInventoryEntry[] {
  if (!Array.isArray(value)) throw new TypeError("files must be an array");
  return value.map((entry, index) => {
    const item = record(entry, `files[${String(index)}]`);
    exactKeys(item, ["relativePath", "size", "sha256"], `files[${String(index)}]`);
    return {
      relativePath: text(item.relativePath, `files[${String(index)}].relativePath`),
      size: integer(item.size, `files[${String(index)}].size`),
      sha256: sha256(item.sha256, `files[${String(index)}].sha256`),
    };
  });
}

export function parseCandidateSnapshotManifest(value: unknown): CandidateSnapshotManifest {
  const item = record(value, "snapshot manifest");
  exactKeys(
    item,
    [
      "schemaVersion",
      "snapshotId",
      "contentHash",
      "createdAt",
      "specPath",
      "fileCount",
      "totalBytes",
      "files",
    ],
    "snapshot manifest",
  );
  if (item.schemaVersion !== productSchemaVersion) throw new TypeError("unsupported schemaVersion");
  const files = parseInventory(item.files);
  const contentHash = sha256(item.contentHash, "contentHash");
  const parsed: CandidateSnapshotManifest = {
    schemaVersion: productSchemaVersion,
    snapshotId: snapshotId(item.snapshotId),
    contentHash,
    createdAt: timestamp(item.createdAt, "createdAt"),
    specPath: text(item.specPath, "specPath"),
    fileCount: integer(item.fileCount, "fileCount"),
    totalBytes: integer(item.totalBytes, "totalBytes"),
    files,
  };
  if (parsed.snapshotId !== createCandidateSnapshotId(parsed.specPath, contentHash)) {
    throw new TypeError("snapshotId does not match specPath and contentHash");
  }
  if (parsed.fileCount !== files.length) throw new TypeError("fileCount does not match files");
  if (parsed.totalBytes !== files.reduce((sum, file) => sum + file.size, 0)) {
    throw new TypeError("totalBytes does not match files");
  }
  return parsed;
}

function parseProductError(value: unknown): ProductErrorData {
  const item = record(value, "run error");
  exactKeys(item, ["code", "category", "message", "retryable"], "run error");
  const code = text(item.code, "error.code");
  if (!productErrorCodes.includes(code as ProductErrorCode))
    throw new TypeError("invalid error.code");
  const category = text(item.category, "error.category");
  const categories: ProductErrorCategory[] = [
    "INPUT",
    "SECURITY",
    "STATE",
    "REVIEW",
    "INFRASTRUCTURE",
    "INTERNAL",
  ];
  if (!categories.includes(category as ProductErrorCategory)) {
    throw new TypeError("invalid error.category");
  }
  if (typeof item.retryable !== "boolean") throw new TypeError("error.retryable must be boolean");
  return {
    code: code as ProductErrorCode,
    category: category as ProductErrorCategory,
    message: text(item.message, "error.message"),
    retryable: item.retryable,
  };
}

export function parseVerificationRunRecord(value: unknown): VerificationRunRecord {
  const item = record(value, "run record");
  exactKeys(
    item,
    [
      "schemaVersion",
      "runId",
      "snapshotId",
      "verifierProfileId",
      "status",
      "revision",
      "createdAt",
      "updatedAt",
      "verdict",
      "reportId",
      "error",
    ],
    "run record",
  );
  if (item.schemaVersion !== productSchemaVersion) throw new TypeError("unsupported schemaVersion");
  const status = text(item.status, "status");
  if (!verificationRunStatuses.includes(status as VerificationRunStatus)) {
    throw new TypeError("invalid run status");
  }
  if (item.verifierProfileId !== frozenA11ProfileId) {
    throw new TypeError("unsupported verifier profile");
  }
  const result: VerificationRunRecord = {
    schemaVersion: productSchemaVersion,
    runId: text(item.runId, "runId"),
    snapshotId: snapshotId(item.snapshotId),
    verifierProfileId: frozenA11ProfileId,
    status: status as VerificationRunStatus,
    revision: integer(item.revision, "revision"),
    createdAt: timestamp(item.createdAt, "createdAt"),
    updatedAt: timestamp(item.updatedAt, "updatedAt"),
  };
  if (item.verdict !== undefined) {
    if (item.verdict !== "COMPLETE" && item.verdict !== "INCOMPLETE") {
      throw new TypeError("invalid verdict");
    }
    result.verdict = item.verdict;
  }
  if (item.reportId !== undefined) result.reportId = text(item.reportId, "reportId");
  if (item.error !== undefined) result.error = parseProductError(item.error);
  if (Date.parse(result.updatedAt) < Date.parse(result.createdAt)) {
    throw new TypeError("updatedAt precedes createdAt");
  }
  if (result.status === "SUCCEEDED") {
    if (
      result.verdict === undefined ||
      result.reportId === undefined ||
      result.error !== undefined
    ) {
      throw new TypeError("successful run has invalid terminal fields");
    }
  } else if (result.status === "FAILED") {
    if (
      result.error === undefined ||
      result.verdict !== undefined ||
      result.reportId !== undefined
    ) {
      throw new TypeError("failed run has invalid terminal fields");
    }
  } else if (
    result.verdict !== undefined ||
    result.reportId !== undefined ||
    result.error !== undefined
  ) {
    throw new TypeError("nonterminal or cancelled run has terminal fields");
  }
  return result;
}
