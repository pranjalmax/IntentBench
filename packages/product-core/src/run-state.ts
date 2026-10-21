import { ProductError, type ProductErrorData } from "./errors.js";
import {
  frozenA11ProfileId,
  productSchemaVersion,
  type VerificationRunRecord,
  type VerificationRunStatus,
  type VerificationVerdict,
} from "./schemas.js";

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const transitions: Readonly<Record<VerificationRunStatus, readonly VerificationRunStatus[]>> = {
  PENDING: ["REVIEWING", "FAILED", "CANCELLED"],
  REVIEWING: ["CALIBRATING", "FAILED", "CANCELLED"],
  CALIBRATING: ["SUCCEEDED", "FAILED"],
  SUCCEEDED: [],
  FAILED: [],
  CANCELLED: [],
};

export interface CreateVerificationRunInput {
  runId: string;
  snapshotId: string;
  createdAt: string;
}

export interface TransitionVerificationRunInput {
  to: VerificationRunStatus;
  at: string;
  expectedRevision: number;
  verdict?: VerificationVerdict;
  reportId?: string;
  error?: ProductErrorData;
}

function assertIdentifier(value: string, label: string): void {
  if (!identifierPattern.test(value)) {
    throw new ProductError("RUN_INVALID_TRANSITION", `${label} is invalid`, { category: "STATE" });
  }
}

function assertTimestamp(value: string, label: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new ProductError("RUN_INVALID_TRANSITION", `${label} must be an ISO timestamp`, {
      category: "STATE",
    });
  }
}

export function createVerificationRun(input: CreateVerificationRunInput): VerificationRunRecord {
  assertIdentifier(input.runId, "runId");
  if (!/^sha256:[a-f0-9]{64}$/u.test(input.snapshotId)) {
    throw new ProductError("RUN_INVALID_TRANSITION", "snapshotId is invalid", {
      category: "STATE",
    });
  }
  assertTimestamp(input.createdAt, "createdAt");
  return {
    schemaVersion: productSchemaVersion,
    runId: input.runId,
    snapshotId: input.snapshotId,
    verifierProfileId: frozenA11ProfileId,
    status: "PENDING",
    revision: 0,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
}

export function transitionVerificationRun(
  current: VerificationRunRecord,
  input: TransitionVerificationRunInput,
): VerificationRunRecord {
  if (input.expectedRevision !== current.revision) {
    throw new ProductError(
      "RUN_CONFLICT",
      `run revision conflict: expected ${String(input.expectedRevision)}, current ${String(current.revision)}`,
      { category: "STATE", retryable: true },
    );
  }
  if (!transitions[current.status].includes(input.to)) {
    throw new ProductError(
      "RUN_INVALID_TRANSITION",
      `run cannot transition from ${current.status} to ${input.to}`,
      { category: "STATE" },
    );
  }
  assertTimestamp(input.at, "transition timestamp");
  if (Date.parse(input.at) < Date.parse(current.updatedAt)) {
    throw new ProductError("RUN_INVALID_TRANSITION", "transition timestamp moved backwards", {
      category: "STATE",
    });
  }

  if (input.to === "SUCCEEDED" && (input.verdict === undefined || input.reportId === undefined)) {
    throw new ProductError(
      "RUN_INVALID_TRANSITION",
      "successful runs require verdict and report provenance",
      { category: "STATE" },
    );
  }
  if (input.to === "FAILED" && input.error === undefined) {
    throw new ProductError("RUN_INVALID_TRANSITION", "failed runs require a structured error", {
      category: "STATE",
    });
  }
  if (input.to !== "SUCCEEDED" && (input.verdict !== undefined || input.reportId !== undefined)) {
    throw new ProductError(
      "RUN_INVALID_TRANSITION",
      "only successful runs may reference a verdict and report",
      { category: "STATE" },
    );
  }
  if (input.to !== "FAILED" && input.error !== undefined) {
    throw new ProductError("RUN_INVALID_TRANSITION", "only failed runs may contain an error", {
      category: "STATE",
    });
  }

  const next: VerificationRunRecord = {
    ...current,
    status: input.to,
    revision: current.revision + 1,
    updatedAt: input.at,
  };
  if (input.verdict !== undefined) next.verdict = input.verdict;
  if (input.reportId !== undefined) {
    assertIdentifier(input.reportId, "reportId");
    next.reportId = input.reportId;
  }
  if (input.error !== undefined) next.error = input.error;
  return next;
}
