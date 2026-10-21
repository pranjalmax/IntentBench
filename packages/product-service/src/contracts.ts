import type { CandidateSnapshot, VerificationReport } from "../../product-core/src/index.js";

export const activitySources = ["SYSTEM", "EXECUTOR", "MODEL", "GATE"] as const;
export type ActivitySource = (typeof activitySources)[number];

export interface VerificationActivityEvent {
  schemaVersion: "1.0.0";
  runId: string;
  sequence: number;
  occurredAt: string;
  source: ActivitySource;
  kind: string;
  message: string;
}

export interface ModelActivity {
  kind: string;
  message: string;
}

export interface IsolatedExecutionRequest {
  runId: string;
  workspace: string;
  outputDirectory: string;
  prompt: string;
  signal: AbortSignal;
  onActivity: (activity: ModelActivity) => Promise<void>;
}

export interface IsolatedExecutionResult {
  exitCode: number | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  finalOutput: string;
  startedAt?: string;
  completedAt?: string;
}

export interface IsolatedVerifierExecutor {
  verifyAvailable(): Promise<void>;
  execute(request: IsolatedExecutionRequest): Promise<IsolatedExecutionResult>;
}

export interface VerificationModelRunnerInput {
  runId: string;
  workspace: string;
  signal: AbortSignal;
  onActivity: (activity: ModelActivity) => Promise<void>;
  now: () => string;
}

export interface VerificationModelRunnerResult {
  rawReview: unknown;
  startedAt: string;
  completedAt: string;
}

export interface VerificationModelRunner {
  verifyAvailable(): Promise<void>;
  run(input: VerificationModelRunnerInput): Promise<VerificationModelRunnerResult>;
}

export type VerificationOutcome =
  | "PENDING"
  | "RUNNING"
  | "COMPLETE"
  | "INCOMPLETE"
  | "UNKNOWN"
  | "INFRASTRUCTURE_FAILURE"
  | "CANCELLED";

export interface VerificationStatusView {
  runId: string;
  snapshotId: string;
  status: "PENDING" | "REVIEWING" | "CALIBRATING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  outcome: VerificationOutcome;
  revision: number;
  createdAt: string;
  updatedAt: string;
  verdict?: "COMPLETE" | "INCOMPLETE";
  reportId?: string;
  error?: { code: string; category: string; message: string; retryable: boolean };
}

export interface CreateRunInput {
  archivePath: string;
  specPath?: string;
  runId?: string;
}

export interface PersistedVerificationArtifacts {
  snapshot: CandidateSnapshot;
  report?: VerificationReport;
}
