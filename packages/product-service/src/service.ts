import { randomUUID } from "node:crypto";
import path from "node:path";

import {
  FileRunStore,
  ProductError,
  calibrateWithFrozenA11,
  createVerificationRun,
  intakeRepositoryArchive,
  transitionVerificationRun,
  type ProductErrorData,
  type VerificationRunRecord,
  type VerificationRunStatus,
} from "../../product-core/src/index.js";
import type {
  ActivitySource,
  CreateRunInput,
  VerificationActivityEvent,
  VerificationModelRunner,
  VerificationOutcome,
  VerificationStatusView,
} from "./contracts.js";
import { FileEventStore } from "./event-store.js";
import { renderReportJson, renderReportMarkdown } from "./exports.js";
import { FileReportStore } from "./report-store.js";

export interface VerificationServiceOptions {
  dataRoot: string;
  runner: VerificationModelRunner;
  now?: () => string;
  idFactory?: () => string;
}

function terminal(status: VerificationRunStatus): boolean {
  return status === "SUCCEEDED" || status === "FAILED" || status === "CANCELLED";
}

function outcome(record: VerificationRunRecord): VerificationOutcome {
  if (record.status === "PENDING") return "PENDING";
  if (record.status === "REVIEWING" || record.status === "CALIBRATING") return "RUNNING";
  if (record.status === "CANCELLED") return "CANCELLED";
  if (record.status === "SUCCEEDED") return record.verdict ?? "UNKNOWN";
  if (record.error?.category === "REVIEW") return "UNKNOWN";
  return "INFRASTRUCTURE_FAILURE";
}

function view(record: VerificationRunRecord): VerificationStatusView {
  return {
    runId: record.runId,
    snapshotId: record.snapshotId,
    status: record.status,
    outcome: outcome(record),
    revision: record.revision,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    ...(record.verdict === undefined ? {} : { verdict: record.verdict }),
    ...(record.reportId === undefined ? {} : { reportId: record.reportId }),
    ...(record.error === undefined ? {} : { error: record.error }),
  };
}

function publicMessage(message: string): string {
  const flattened = message
    .replaceAll(/[\r\n\t]+/gu, " ")
    .trim()
    .slice(0, 500);
  return flattened
    .replaceAll(/sk-[A-Za-z0-9_-]{16,}/gu, "<REDACTED>")
    .replaceAll(/-----BEGIN [^-]+ PRIVATE KEY-----/gu, "<REDACTED>")
    .replaceAll(/\b[A-Za-z]:\\(?:[^\\\s"'`;]+\\)*[^\\\s"'`;]*/gu, "<PATH>")
    .replaceAll(/\/(?:home|Users|root|tmp)(?:\/[^\s"'`;]+)+/gu, "<PATH>");
}

function errorData(error: unknown): ProductErrorData {
  if (error instanceof ProductError) return error.toData();
  return new ProductError("INTERNAL_ERROR", "verification failed unexpectedly", {
    category: "INTERNAL",
    retryable: true,
    cause: error,
  }).toData();
}

export class VerificationService {
  readonly dataRoot: string;
  readonly runStore: FileRunStore;
  readonly eventStore: FileEventStore;
  readonly reportStore: FileReportStore;
  private readonly runner: VerificationModelRunner;
  private readonly now: () => string;
  private readonly idFactory: () => string;
  private readonly controllers = new Map<string, AbortController>();
  private readonly jobs = new Map<string, Promise<void>>();
  private readonly eventChains = new Map<string, Promise<unknown>>();
  private initialization?: Promise<void>;
  private closed = false;

  constructor(options: VerificationServiceOptions) {
    this.dataRoot = path.resolve(options.dataRoot);
    this.runner = options.runner;
    this.now = options.now ?? (() => new Date().toISOString());
    this.idFactory = options.idFactory ?? randomUUID;
    this.runStore = new FileRunStore(path.join(this.dataRoot, "runs"));
    this.eventStore = new FileEventStore(path.join(this.dataRoot, "events"));
    this.reportStore = new FileReportStore(path.join(this.dataRoot, "reports"));
  }

  async initialize(): Promise<void> {
    this.initialization ??= this.recoverInterruptedRuns();
    await this.initialization;
  }

  private async recoverInterruptedRuns(): Promise<void> {
    for (const runId of await this.runStore.listRunIds()) {
      const record = await this.runStore.read(runId);
      if (terminal(record.status)) continue;
      const failed = transitionVerificationRun(record, {
        to: "FAILED",
        at: this.now(),
        expectedRevision: record.revision,
        error: new ProductError(
          "EXECUTOR_UNAVAILABLE",
          "verification was interrupted by a service restart",
          {
            category: "INFRASTRUCTURE",
            retryable: true,
          },
        ).toData(),
      });
      await this.runStore.append(failed);
      await this.emit(runId, "SYSTEM", "RUN_INTERRUPTED", "The interrupted run was closed safely.");
    }
  }

  async createRun(input: CreateRunInput): Promise<VerificationStatusView> {
    await this.initialize();
    if (this.closed) {
      throw new ProductError("EXECUTOR_UNAVAILABLE", "verification service is shutting down", {
        category: "INFRASTRUCTURE",
        retryable: true,
      });
    }
    const snapshot = await intakeRepositoryArchive({
      archivePath: input.archivePath,
      snapshotsRoot: path.join(this.dataRoot, "snapshots"),
      ...(input.specPath === undefined ? {} : { specPath: input.specPath }),
    });
    const runId = input.runId ?? `run_${this.idFactory().replaceAll("-", "")}`;
    const run = createVerificationRun({
      runId,
      snapshotId: snapshot.snapshotId,
      createdAt: this.now(),
    });
    await this.runStore.create(run);
    await this.emit(
      runId,
      "SYSTEM",
      "RUN_ACCEPTED",
      "The immutable candidate snapshot was accepted.",
    );
    const controller = new AbortController();
    this.controllers.set(runId, controller);
    const job = this.execute(runId, snapshot.candidatePath, controller).finally(() => {
      this.controllers.delete(runId);
      this.jobs.delete(runId);
    });
    this.jobs.set(runId, job);
    void job.catch(() => undefined);
    return view(run);
  }

  private async execute(
    runId: string,
    workspace: string,
    controller: AbortController,
  ): Promise<void> {
    const wasCancelled = (): boolean => controller.signal.aborted;
    try {
      await this.runner.verifyAvailable();
      if (wasCancelled()) throw new DOMException("cancelled", "AbortError");
      let run = await this.runStore.read(runId);
      run = transitionVerificationRun(run, {
        to: "REVIEWING",
        at: this.now(),
        expectedRevision: run.revision,
      });
      await this.runStore.append(run);
      await this.emit(
        runId,
        "EXECUTOR",
        "ISOLATION_READY",
        "The isolated verifier environment was validated.",
      );
      const result = await this.runner.run({
        runId,
        workspace,
        signal: controller.signal,
        now: this.now,
        onActivity: async (activity) =>
          await this.emit(runId, "MODEL", activity.kind, activity.message),
      });
      if (wasCancelled()) throw new DOMException("cancelled", "AbortError");
      run = await this.runStore.read(runId);
      run = transitionVerificationRun(run, {
        to: "CALIBRATING",
        at: this.now(),
        expectedRevision: run.revision,
      });
      await this.runStore.append(run);
      await this.emit(
        runId,
        "GATE",
        "CALIBRATION_STARTED",
        "The frozen deterministic gate started calibration.",
      );
      const report = calibrateWithFrozenA11({
        reportId: `report_${this.idFactory().replaceAll("-", "")}`,
        runId,
        snapshotId: run.snapshotId,
        generatedAt: this.now(),
        rawReview: result.rawReview,
      });
      await this.reportStore.create(report);
      run = transitionVerificationRun(run, {
        to: "SUCCEEDED",
        at: this.now(),
        expectedRevision: run.revision,
        verdict: report.verdict,
        reportId: report.reportId,
      });
      await this.runStore.append(run);
      await this.emit(
        runId,
        "GATE",
        "VERDICT_PERSISTED",
        `The calibrated ${report.verdict} verdict was persisted.`,
      );
    } catch (error) {
      const current = await this.runStore.read(runId);
      if (terminal(current.status)) return;
      if (wasCancelled() || (error instanceof DOMException && error.name === "AbortError")) {
        const cancelled = transitionVerificationRun(current, {
          to: "CANCELLED",
          at: this.now(),
          expectedRevision: current.revision,
        });
        await this.runStore.append(cancelled);
        await this.emit(
          runId,
          "SYSTEM",
          "RUN_CANCELLED",
          "The verification run was cancelled and cleaned up.",
        );
        return;
      }
      const failed = transitionVerificationRun(current, {
        to: "FAILED",
        at: this.now(),
        expectedRevision: current.revision,
        error: errorData(error),
      });
      await this.runStore.append(failed);
      await this.emit(
        runId,
        "SYSTEM",
        "RUN_FAILED",
        "The verification run ended without a semantic verdict.",
      );
    }
  }

  private async emit(
    runId: string,
    source: ActivitySource,
    kind: string,
    message: string,
  ): Promise<void> {
    const previous = this.eventChains.get(runId) ?? Promise.resolve();
    const next = previous.then(
      async () =>
        await this.eventStore.append({
          runId,
          occurredAt: this.now(),
          source,
          kind:
            kind
              .toUpperCase()
              .replaceAll(/[^A-Z0-9_]/gu, "_")
              .slice(0, 64) || "ACTIVITY",
          message: publicMessage(message),
        }),
    );
    this.eventChains.set(runId, next);
    await next;
  }

  async getStatus(runId: string): Promise<VerificationStatusView> {
    await this.initialize();
    return view(await this.runStore.read(runId));
  }

  async checkExecutor(): Promise<{ available: boolean; checkedAt: string; message: string }> {
    try {
      await this.runner.verifyAvailable();
      return {
        available: true,
        checkedAt: this.now(),
        message:
          "Frozen profile, Docker runtime, image and isolated authentication metadata are available. No model request was made.",
      };
    } catch {
      return {
        available: false,
        checkedAt: this.now(),
        message:
          "Isolation preflight is unavailable. New verification fails closed. Check Docker, the pinned image and isolated authentication locally. No model request was made.",
      };
    }
  }

  async getEvents(runId: string, after = 0): Promise<VerificationActivityEvent[]> {
    await this.runStore.read(runId);
    await this.eventChains.get(runId);
    return await this.eventStore.read(runId, after);
  }

  async getReport(runId: string) {
    const run = await this.runStore.read(runId);
    if (run.status !== "SUCCEEDED") {
      throw new ProductError("RUN_CONFLICT", "a calibrated report is not available for this run", {
        category: "STATE",
      });
    }
    return await this.reportStore.read(runId);
  }

  async exportReport(runId: string, format: "json" | "markdown"): Promise<string> {
    const report = await this.getReport(runId);
    return format === "json" ? renderReportJson(report) : renderReportMarkdown(report);
  }

  async cancel(runId: string): Promise<VerificationStatusView> {
    const current = await this.runStore.read(runId);
    if (terminal(current.status)) return view(current);
    const controller = this.controllers.get(runId);
    if (controller !== undefined) {
      await this.emit(runId, "SYSTEM", "CANCEL_REQUESTED", "Cancellation was requested.");
      controller.abort();
      await this.jobs.get(runId);
      return await this.getStatus(runId);
    }
    const cancelled = transitionVerificationRun(current, {
      to: "CANCELLED",
      at: this.now(),
      expectedRevision: current.revision,
    });
    await this.runStore.append(cancelled);
    await this.emit(
      runId,
      "SYSTEM",
      "RUN_CANCELLED",
      "The pending verification run was cancelled.",
    );
    return view(cancelled);
  }

  async waitForStatus(
    runId: string,
    status: VerificationRunStatus,
    timeoutMs = 5_000,
  ): Promise<VerificationStatusView> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() <= deadline) {
      const current = await this.getStatus(runId);
      if (current.status === status) return current;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw new Error(`timed out waiting for ${status}`);
  }

  async waitForTerminal(runId: string, timeoutMs = 5_000): Promise<VerificationStatusView> {
    const job = this.jobs.get(runId);
    if (job !== undefined)
      await Promise.race([
        job,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timed out waiting for run")), timeoutMs),
        ),
      ]);
    const current = await this.getStatus(runId);
    if (!terminal(current.status)) throw new Error("run did not reach a terminal state");
    return current;
  }

  async shutdown(): Promise<void> {
    this.closed = true;
    await Promise.all([...this.controllers.keys()].map(async (runId) => await this.cancel(runId)));
    await Promise.allSettled([...this.jobs.values()]);
  }
}
