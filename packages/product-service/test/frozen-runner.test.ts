import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { FrozenA11ModelRunner, frozenA11Profile } from "../src/index.js";
import { FakeIsolatedExecutor, sha256, supportingReview } from "./test-support.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("frozen A1.1 model runner", () => {
  it("refuses changed prompt/config/gate identities before isolated execution", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "intentbench-frozen-runner-"));
    roots.push(root);
    const promptPath = path.join(root, "prompt.md");
    const configPath = path.join(root, "config.json");
    const gatePath = path.join(root, "gate.ts");
    await writeFile(promptPath, "changed prompt");
    await writeFile(configPath, "{}\n");
    await writeFile(gatePath, "changed gate");
    const executor = new FakeIsolatedExecutor({
      exitCode: 0,
      timedOut: false,
      stdout: "",
      stderr: "",
      finalOutput: JSON.stringify(supportingReview()),
    });
    const runner = new FrozenA11ModelRunner({ executor, promptPath, configPath, gatePath });

    await expect(runner.verifyAvailable()).rejects.toMatchObject({ code: "EXECUTION_FORBIDDEN" });
    expect(executor.requests).toHaveLength(0);
  });

  it("parses genuine isolated output and forwards only sanitized activity", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "intentbench-frozen-runner-"));
    roots.push(root);
    const workspace = path.join(root, "candidate");
    await mkdir(workspace);
    const executor = new FakeIsolatedExecutor(
      {
        exitCode: 0,
        timedOut: false,
        stdout: '{"type":"turn.completed"}\n',
        stderr: "",
        finalOutput: JSON.stringify(supportingReview()),
      },
      [{ kind: "FILE_INSPECTED", message: "Inspected <CANDIDATE>/src/counter.ts" }],
    );
    const runner = new FrozenA11ModelRunner({
      executor,
      promptPath: path.resolve("profiles/a1.1/prompt.md"),
      configPath: path.resolve("profiles/a1.1/config.json"),
      gatePath: path.resolve("packages/advanced-verifier/src/gate.ts"),
    });
    const activity: string[] = [];
    const result = await runner.run({
      runId: "run_frozen",
      workspace,
      signal: new AbortController().signal,
      onActivity: (event) => {
        activity.push(event.message);
        return Promise.resolve();
      },
      now: () => "2026-10-09T12:00:00.000Z",
    });

    const request = executor.requests[0];
    if (request === undefined) throw new Error("isolated request was not recorded");
    expect(sha256(request.prompt)).toBe(frozenA11Profile.promptHash);
    expect(result.rawReview).toEqual(supportingReview());
    expect(activity).toEqual(["Inspected <CANDIDATE>/src/counter.ts"]);
  });

  it("classifies a model usage limit as infrastructure rather than UNKNOWN", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "intentbench-frozen-runner-"));
    roots.push(root);
    const workspace = path.join(root, "candidate");
    await mkdir(workspace);
    const executor = new FakeIsolatedExecutor({
      exitCode: 1,
      timedOut: false,
      stdout: "",
      stderr: "Usage limit reached. Try again later.",
      finalOutput: "",
    });
    const runner = new FrozenA11ModelRunner({
      executor,
      promptPath: path.resolve("profiles/a1.1/prompt.md"),
      configPath: path.resolve("profiles/a1.1/config.json"),
      gatePath: path.resolve("packages/advanced-verifier/src/gate.ts"),
    });

    await expect(
      runner.run({
        runId: "run_usage_limit",
        workspace,
        signal: new AbortController().signal,
        onActivity: () => Promise.resolve(),
        now: () => "2026-10-09T12:00:00.000Z",
      }),
    ).rejects.toMatchObject({ code: "EXECUTOR_UNAVAILABLE", category: "INFRASTRUCTURE" });
  });

  it("classifies expired isolated authentication as infrastructure", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "intentbench-frozen-runner-"));
    roots.push(root);
    const workspace = path.join(root, "candidate");
    await mkdir(workspace);
    const executor = new FakeIsolatedExecutor({
      exitCode: 1,
      timedOut: false,
      stdout: '{"type":"error","message":"refresh token was already used; sign in again"}\n',
      stderr: "",
      finalOutput: "",
    });
    const runner = new FrozenA11ModelRunner({
      executor,
      promptPath: path.resolve("profiles/a1.1/prompt.md"),
      configPath: path.resolve("profiles/a1.1/config.json"),
      gatePath: path.resolve("packages/advanced-verifier/src/gate.ts"),
    });

    await expect(
      runner.run({
        runId: "run_expired_auth",
        workspace,
        signal: new AbortController().signal,
        onActivity: () => Promise.resolve(),
        now: () => "2026-10-09T12:00:00.000Z",
      }),
    ).rejects.toMatchObject({
      code: "EXECUTOR_UNAVAILABLE",
      category: "INFRASTRUCTURE",
      message: "isolated authentication must be refreshed",
    });
  });
});
