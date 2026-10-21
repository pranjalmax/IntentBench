import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  DockerIsolatedVerifierExecutor,
  type ProcessInvocation,
  type ProcessResult,
  type ProcessRunner,
} from "../src/index.js";
import type { ProductError } from "../src/index.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

class RecordingProcessRunner implements ProcessRunner {
  readonly invocations: ProcessInvocation[] = [];
  constructor(private readonly results: ProcessResult[]) {}

  run(invocation: ProcessInvocation): Promise<ProcessResult> {
    this.invocations.push(invocation);
    const result =
      this.results.shift() ??
      ({
        exitCode: 0,
        signal: null,
        stdout: "",
        stderr: "",
        timedOut: false,
      } satisfies ProcessResult);
    invocation.onStdout?.(result.stdout);
    invocation.onStderr?.(result.stderr);
    return Promise.resolve(result);
  }
}

class RejectingProcessRunner implements ProcessRunner {
  run(): Promise<ProcessResult> {
    return Promise.reject(new Error("spawn docker ENOENT"));
  }
}

describe("Docker isolated executor", () => {
  it("fails closed when the pinned isolation image is unavailable", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "intentbench-docker-executor-"));
    roots.push(root);
    const authFile = path.join(root, "auth.json");
    await writeFile(authFile, "{}\n");
    const processes = new RecordingProcessRunner([
      { exitCode: 1, signal: null, stdout: "", stderr: "not found", timedOut: false },
    ]);
    const executor = new DockerIsolatedVerifierExecutor({ authFile, processRunner: processes });

    await expect(executor.verifyAvailable()).rejects.toMatchObject({
      code: "EXECUTOR_UNAVAILABLE",
    } satisfies Partial<ProductError>);
  });

  it("classifies a missing Docker executable as unavailable infrastructure", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "intentbench-docker-executor-"));
    roots.push(root);
    const authFile = path.join(root, "auth.json");
    await writeFile(authFile, "{}\n");
    const executor = new DockerIsolatedVerifierExecutor({
      authFile,
      processRunner: new RejectingProcessRunner(),
    });

    await expect(executor.verifyAvailable()).rejects.toMatchObject({
      code: "EXECUTOR_UNAVAILABLE",
      category: "INFRASTRUCTURE",
    });
  });

  it("uses the locked image, read-only auth, bounded mounts, and shell-network denial", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "intentbench-docker-executor-"));
    roots.push(root);
    const authFile = path.join(root, "auth.json");
    const workspace = path.join(root, "workspace");
    const outputDirectory = path.join(root, "output");
    await writeFile(authFile, "{}\n");
    await mkdir(workspace);
    await mkdir(outputDirectory);
    const processes = new RecordingProcessRunner([
      {
        exitCode: 0,
        signal: null,
        stdout: "sha256:e77098ecaea63d73e29b114d18e847aac74379eb686b821046bfc87ec8f67ee4\n",
        stderr: "",
        timedOut: false,
      },
      {
        exitCode: 0,
        signal: null,
        stdout: "sha256:e77098ecaea63d73e29b114d18e847aac74379eb686b821046bfc87ec8f67ee4\n",
        stderr: "",
        timedOut: false,
      },
      { exitCode: 0, signal: null, stdout: "", stderr: "", timedOut: false },
    ]);
    const executor = new DockerIsolatedVerifierExecutor({ authFile, processRunner: processes });
    await executor.verifyAvailable();
    await executor.execute({
      runId: "run_secure",
      workspace,
      outputDirectory,
      prompt: "review",
      signal: new AbortController().signal,
      onActivity: () => Promise.resolve(),
    });

    const invocation = processes.invocations[2];
    if (invocation === undefined) throw new Error("Docker run invocation was not recorded");
    const command = [invocation.command, ...invocation.args].join(" ");
    expect(command).toContain("--read-only");
    expect(command).toContain("--cap-drop ALL");
    expect(command).toContain("network={enabled=false}");
    expect(command).toContain(`source=${authFile},target=/intentbench-auth/auth.json,readonly`);
    expect(command).toContain(`source=${workspace},target=/workspace`);
    expect(command).toContain(`source=${outputDirectory},target=/intentbench-output`);
    expect(command).not.toContain("docker.sock");
    expect(invocation.args.filter((value) => value.startsWith("type=bind,"))).toHaveLength(3);

    await writeFile(path.join(outputDirectory, "container.cid"), "a".repeat(64));
    await invocation.onAbort?.();
    expect(processes.invocations.at(-1)?.args).toEqual(["stop", "--time", "2", "a".repeat(64)]);
  });

  it("publishes a safe authentication-expiry category without exposing raw model errors", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "intentbench-docker-executor-"));
    roots.push(root);
    const authFile = path.join(root, "auth.json");
    const workspace = path.join(root, "workspace");
    const outputDirectory = path.join(root, "output");
    await writeFile(authFile, "{}\n");
    await mkdir(workspace);
    await mkdir(outputDirectory);
    const rawError = "Your refresh token was already used. Please log out and sign in again.";
    const processes = new RecordingProcessRunner([
      {
        exitCode: 0,
        signal: null,
        stdout: "sha256:e77098ecaea63d73e29b114d18e847aac74379eb686b821046bfc87ec8f67ee4\n",
        stderr: "",
        timedOut: false,
      },
      {
        exitCode: 1,
        signal: null,
        stdout: `${JSON.stringify({ type: "error", message: rawError })}\n`,
        stderr: "",
        timedOut: false,
      },
    ]);
    const executor = new DockerIsolatedVerifierExecutor({ authFile, processRunner: processes });
    const activities: { kind: string; message: string }[] = [];

    await executor.execute({
      runId: "run_expired_auth",
      workspace,
      outputDirectory,
      prompt: "review",
      signal: new AbortController().signal,
      onActivity: (activity) => {
        activities.push(activity);
        return Promise.resolve();
      },
    });

    expect(activities).toEqual([
      {
        kind: "MODEL_AUTHENTICATION_REQUIRED",
        message: "The dedicated isolated verifier authentication must be refreshed.",
      },
    ]);
    expect(JSON.stringify(activities)).not.toContain(rawError);
  });
});
