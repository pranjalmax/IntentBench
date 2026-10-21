import os from "node:os";
import path from "node:path";

import { DockerIsolatedVerifierExecutor } from "./docker-executor.js";
import { FrozenA11ModelRunner } from "./frozen-runner.js";
import { createIntentBenchServer } from "./http-server.js";
import { VerificationService } from "./service.js";
import { ResearchArchive } from "./research-archive.js";
import { ProductError } from "../../product-core/src/errors.js";
import type { VerificationModelRunner } from "./contracts.js";

export interface ProductRuntimeConfig {
  repositoryRoot: string;
  dataRoot: string;
  uploadRoot: string;
  mode: "recorded" | "live";
  authFile: string | null;
  host: string;
  port: number;
  maxArchiveBytes: number;
}

function isWithin(root: string, target: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  );
}

export function loadProductRuntimeConfig(
  environment: Record<string, string | undefined>,
  currentDirectory: string,
): ProductRuntimeConfig {
  const mode = environment.INTENTBENCH_MODE ?? "recorded";
  if (mode !== "recorded" && mode !== "live")
    throw new Error("INTENTBENCH_MODE must be recorded or live");
  const authFile = mode === "live" ? environment.INTENTBENCH_AUTH_FILE : undefined;
  if (mode === "live" && (authFile === undefined || authFile.trim() === "")) {
    throw new Error("INTENTBENCH_AUTH_FILE is required and must name isolated authentication");
  }
  const resolvedAuthFile = authFile ? path.resolve(authFile) : null;
  const ambientHomes = [path.join(os.homedir(), ".codex"), environment.CODEX_HOME]
    .filter((value): value is string => value !== undefined && value.trim() !== "")
    .map((value) => path.resolve(value));
  if (resolvedAuthFile && ambientHomes.some((home) => isWithin(home, resolvedAuthFile))) {
    throw new Error("INTENTBENCH_AUTH_FILE must use a dedicated isolated authentication home");
  }
  const repositoryRoot = path.resolve(currentDirectory);
  const dataRoot = path.resolve(
    environment.INTENTBENCH_DATA_ROOT ?? path.join(repositoryRoot, ".intentbench-data"),
  );
  const rawPort = environment.INTENTBENCH_PORT ?? "4317";
  const port = Number(rawPort);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error("INTENTBENCH_PORT must be an integer from 1 through 65535");
  }
  const host = environment.INTENTBENCH_HOST ?? "127.0.0.1";
  if (host !== "127.0.0.1" && host !== "::1" && host !== "localhost") {
    throw new Error("INTENTBENCH_HOST must be a loopback address for this milestone");
  }
  return {
    repositoryRoot,
    mode,
    dataRoot,
    uploadRoot: path.join(dataRoot, "uploads"),
    authFile: resolvedAuthFile,
    host,
    port,
    maxArchiveBytes: 10 * 1024 * 1024,
  };
}

export function createProductRuntime(config: ProductRuntimeConfig) {
  const disabled = (): Promise<never> =>
    Promise.reject(
      new ProductError(
        "EXECUTOR_UNAVAILABLE",
        "Recorded-only mode: live verification is disabled.",
        { category: "INFRASTRUCTURE", retryable: false },
      ),
    );
  let runner: VerificationModelRunner = { verifyAvailable: disabled, run: disabled };
  if (config.mode === "live") {
    if (!config.authFile) throw new Error("INTENTBENCH_AUTH_FILE is required for live mode");
    runner = new FrozenA11ModelRunner({
      executor: new DockerIsolatedVerifierExecutor({ authFile: config.authFile }),
      promptPath: path.join(config.repositoryRoot, "profiles", "a1.1", "prompt.md"),
      configPath: path.join(config.repositoryRoot, "profiles", "a1.1", "config.json"),
      gatePath: path.join(config.repositoryRoot, "packages", "advanced-verifier", "src", "gate.ts"),
      runtimeRoot: path.join(config.dataRoot, "runtime"),
    });
  }
  const service = new VerificationService({ dataRoot: config.dataRoot, runner });
  const server = createIntentBenchServer({
    service,
    liveVerificationEnabled: config.mode === "live",
    uploadRoot: config.uploadRoot,
    maxArchiveBytes: config.maxArchiveBytes,
    webRoot: path.join(config.repositoryRoot, "dist", "product-web"),
    research: new ResearchArchive(config.repositoryRoot),
    localAddress: `http://${config.host === "::1" ? "[::1]" : config.host}:${String(config.port)}`,
  });
  return { service, server };
}
