import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { ProductError, frozenA11Profile } from "../../product-core/src/index.js";
import type {
  IsolatedVerifierExecutor,
  VerificationModelRunnerInput,
  VerificationModelRunnerResult,
} from "./contracts.js";

export interface FrozenA11ModelRunnerOptions {
  executor: IsolatedVerifierExecutor;
  promptPath: string;
  configPath: string;
  gatePath: string;
  runtimeRoot?: string;
}

async function hashFile(target: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(target))
    .digest("hex");
}

export class FrozenA11ModelRunner {
  private readonly executor: IsolatedVerifierExecutor;
  private readonly promptPath: string;
  private readonly configPath: string;
  private readonly gatePath: string;
  private readonly runtimeRoot: string;

  constructor(options: FrozenA11ModelRunnerOptions) {
    this.executor = options.executor;
    this.promptPath = path.resolve(options.promptPath);
    this.configPath = path.resolve(options.configPath);
    this.gatePath = path.resolve(options.gatePath);
    this.runtimeRoot = path.resolve(
      options.runtimeRoot ?? path.join(os.tmpdir(), "intentbench-product-runs"),
    );
  }

  async verifyAvailable(): Promise<void> {
    const identities = await Promise.all([
      hashFile(this.promptPath),
      hashFile(this.configPath),
      hashFile(this.gatePath),
    ]).catch((error: unknown) => {
      throw new ProductError("EXECUTION_FORBIDDEN", "frozen A1.1 files are unavailable", {
        category: "SECURITY",
        cause: error,
      });
    });
    const expected = [
      frozenA11Profile.promptHash,
      frozenA11Profile.configHash,
      frozenA11Profile.gateHash,
    ];
    if (identities.some((identity, index) => identity !== expected[index])) {
      throw new ProductError("EXECUTION_FORBIDDEN", "frozen A1.1 identity check failed", {
        category: "SECURITY",
      });
    }
    await this.executor.verifyAvailable();
  }

  async run(input: VerificationModelRunnerInput): Promise<VerificationModelRunnerResult> {
    await this.verifyAvailable();
    await mkdir(this.runtimeRoot, { recursive: true });
    const root = await mkdtemp(path.join(this.runtimeRoot, `${input.runId}-`));
    const workspace = path.join(root, "workspace");
    const outputDirectory = path.join(root, "output");
    await cp(input.workspace, workspace, { recursive: true, errorOnExist: true });
    await mkdir(outputDirectory);
    try {
      const prompt = await readFile(this.promptPath, "utf8");
      const result = await this.executor.execute({
        runId: input.runId,
        workspace,
        outputDirectory,
        prompt,
        signal: input.signal,
        onActivity: input.onActivity,
      });
      const processOutput = `${result.stdout}\n${result.stderr}`;
      if (/refresh token|log out and sign in|sign in again/iu.test(processOutput)) {
        throw new ProductError(
          "EXECUTOR_UNAVAILABLE",
          "isolated authentication must be refreshed",
          {
            category: "INFRASTRUCTURE",
            retryable: true,
          },
        );
      }
      if (/usage limit|rate limit|quota exceeded|try again later/iu.test(processOutput)) {
        throw new ProductError("EXECUTOR_UNAVAILABLE", "model service is temporarily unavailable", {
          category: "INFRASTRUCTURE",
          retryable: true,
        });
      }
      if (result.timedOut || result.exitCode !== 0) {
        throw new ProductError("EXECUTOR_UNAVAILABLE", "isolated verifier process failed", {
          category: "INFRASTRUCTURE",
          retryable: true,
        });
      }
      if (Buffer.byteLength(result.finalOutput, "utf8") > 5 * 1024 * 1024) {
        throw new ProductError("REVIEW_OUTPUT_INVALID", "verifier output exceeds the limit", {
          category: "REVIEW",
        });
      }
      let rawReview: unknown;
      try {
        rawReview = JSON.parse(result.finalOutput.trim()) as unknown;
      } catch (error) {
        throw new ProductError("REVIEW_OUTPUT_INVALID", "verifier output is not valid JSON", {
          category: "REVIEW",
          cause: error,
        });
      }
      return {
        rawReview,
        startedAt: result.startedAt ?? input.now(),
        completedAt: result.completedAt ?? input.now(),
      };
    } finally {
      await rm(root, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

export { frozenA11Profile };
