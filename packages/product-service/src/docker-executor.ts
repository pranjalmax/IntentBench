import { lstat, readFile } from "node:fs/promises";
import path from "node:path";

import { ProductError } from "../../product-core/src/index.js";
import type {
  IsolatedExecutionRequest,
  IsolatedExecutionResult,
  ModelActivity,
} from "./contracts.js";
import { NodeProcessRunner, type ProcessRunner } from "./process-runner.js";

const image = "intentbench-codex:0.150.1";
const imageId = "sha256:e77098ecaea63d73e29b114d18e847aac74379eb686b821046bfc87ec8f67ee4";
const disabledFeatures = [
  "plugins",
  "memories",
  "multi_agent",
  "multi_agent_v2",
  "apps",
  "browser_use",
  "browser_use_external",
  "computer_use",
  "in_app_browser",
  "skill_search",
  "hooks",
  "image_generation",
  "plugin_sharing",
  "remote_plugin",
  "workspace_dependencies",
  "tool_suggest",
  "enable_mcp_apps",
  "recommended_plugins",
] as const;
const workspaceOnlyProfile =
  'permissions.workspace-only={extends=":workspace", filesystem={":root"="deny", ":minimal"="read", ":tmpdir"="deny", ":slash_tmp"="deny", "/codex-home"="deny", "/intentbench-auth"="deny", "/intentbench-output"="deny", "/opt/intentbench-image-canary"="deny"}, network={enabled=false}}';

export interface DockerExecutorOptions {
  authFile: string;
  processRunner?: ProcessRunner;
  dockerExecutable?: string;
  timeoutMs?: number;
}

function modelActivity(value: unknown): ModelActivity | undefined {
  if (value === null || typeof value !== "object") return undefined;
  const event = value as { type?: unknown; item?: { type?: unknown }; message?: unknown };
  if (event.type === "turn.started") {
    return { kind: "MODEL_TURN_STARTED", message: "The isolated verifier started reasoning." };
  }
  if (event.type === "turn.completed") {
    return { kind: "MODEL_TURN_COMPLETED", message: "The isolated verifier completed its turn." };
  }
  if (event.type === "error") {
    const message = typeof event.message === "string" ? event.message : "";
    if (/refresh token|log out and sign in|sign in again/iu.test(message)) {
      return {
        kind: "MODEL_AUTHENTICATION_REQUIRED",
        message: "The dedicated isolated verifier authentication must be refreshed.",
      };
    }
    if (/usage limit|rate limit|quota exceeded/iu.test(message)) {
      return {
        kind: "MODEL_CAPACITY_UNAVAILABLE",
        message: "The model service is temporarily unavailable.",
      };
    }
    return { kind: "MODEL_ERROR", message: "The isolated verifier reported an execution error." };
  }
  if (event.item?.type === "command_execution") {
    return {
      kind: "ISOLATED_COMMAND",
      message: "The verifier ran a workspace command in isolation.",
    };
  }
  if (event.item?.type === "file_change") {
    return {
      kind: "WORKSPACE_ACTIVITY",
      message: "The verifier reported workspace file activity.",
    };
  }
  return undefined;
}

export class DockerIsolatedVerifierExecutor {
  private readonly authFile: string;
  private readonly processRunner: ProcessRunner;
  private readonly dockerExecutable: string;
  private readonly timeoutMs: number;

  constructor(options: DockerExecutorOptions) {
    this.authFile = path.resolve(options.authFile);
    this.processRunner = options.processRunner ?? new NodeProcessRunner();
    this.dockerExecutable = options.dockerExecutable ?? "docker";
    this.timeoutMs = options.timeoutMs ?? 900_000;
  }

  async verifyAvailable(): Promise<void> {
    try {
      const auth = await lstat(this.authFile);
      if (!auth.isFile() || auth.isSymbolicLink()) throw new Error("auth is not a regular file");
    } catch (error) {
      throw new ProductError("EXECUTOR_UNAVAILABLE", "isolated authentication is unavailable", {
        category: "INFRASTRUCTURE",
        retryable: true,
        cause: error,
      });
    }
    let inspected;
    try {
      inspected = await this.processRunner.run({
        command: this.dockerExecutable,
        args: ["image", "inspect", "--format", "{{.Id}}", image],
        timeoutMs: 30_000,
        maxOutputBytes: 1024 * 1024,
      });
    } catch (error) {
      throw new ProductError("EXECUTOR_UNAVAILABLE", "Docker isolation is unavailable", {
        category: "INFRASTRUCTURE",
        retryable: true,
        cause: error,
      });
    }
    if (inspected.exitCode !== 0 || inspected.stdout.trim() !== imageId) {
      throw new ProductError(
        "EXECUTOR_UNAVAILABLE",
        "pinned Docker isolation image is unavailable",
        {
          category: "INFRASTRUCTURE",
          retryable: true,
        },
      );
    }
  }

  async execute(request: IsolatedExecutionRequest): Promise<IsolatedExecutionResult> {
    await this.verifyAvailable();
    const workspace = path.resolve(request.workspace);
    const outputDirectory = path.resolve(request.outputDirectory);
    for (const [target, label] of [
      [workspace, "workspace"],
      [outputDirectory, "output directory"],
    ] as const) {
      const stats = await lstat(target);
      if (!stats.isDirectory() || stats.isSymbolicLink()) {
        throw new ProductError("EXECUTION_FORBIDDEN", `${label} must be a regular directory`, {
          category: "SECURITY",
        });
      }
    }
    const cidFile = path.join(outputDirectory, "container.cid");
    const outputFile = path.join(outputDirectory, "final-assistant.txt");
    const codexArgs = [
      "-a",
      "never",
      "exec",
      "-c",
      'default_permissions="workspace-only"',
      "-c",
      workspaceOnlyProfile,
      "-c",
      "allow_login_shell=false",
      "--ephemeral",
      "--ignore-user-config",
      "--ignore-rules",
      "--skip-git-repo-check",
      "--strict-config",
      "-C",
      "/workspace",
      "-m",
      "gpt-5.6-sol",
      "-c",
      'model_reasoning_effort="high"',
      "-c",
      "project_doc_max_bytes=0",
      "-c",
      "mcp_servers={}",
      "-c",
      'shell_environment_policy.inherit="core"',
      "-c",
      'shell_environment_policy.exclude=["*TOKEN*","*KEY*","*SECRET*","*PASSWORD*","OPENAI_*","CODEX_*"]',
      "--json",
      "--color",
      "never",
      "--output-last-message",
      "/intentbench-output/final-assistant.txt",
    ];
    for (const feature of disabledFeatures) codexArgs.push("--disable", feature);
    codexArgs.push(request.prompt);
    const args = [
      "run",
      "--rm",
      "--init",
      "--cidfile",
      cidFile,
      "--read-only",
      "--network",
      "bridge",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges:true",
      "--security-opt",
      "seccomp=unconfined",
      "--pids-limit",
      "256",
      "--tmpfs",
      "/tmp:rw,nosuid,nodev,size=536870912",
      "--tmpfs",
      "/codex-home:rw,nosuid,nodev,uid=10001,gid=10001,mode=0700,size=134217728",
      "--mount",
      `type=bind,source=${workspace},target=/workspace`,
      "--mount",
      `type=bind,source=${outputDirectory},target=/intentbench-output`,
      "--mount",
      `type=bind,source=${this.authFile},target=/intentbench-auth/auth.json,readonly`,
      "--workdir",
      "/workspace",
      "--env",
      "NO_COLOR=1",
      "--label",
      `org.intentbench.product.run=${request.runId}`,
      image,
      ...codexArgs,
    ];
    let pending = "";
    let activityChain: Promise<void> = Promise.resolve();
    const consume = (chunk: string): void => {
      pending += chunk;
      const lines = pending.split(/\r?\n/u);
      pending = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim() === "") continue;
        try {
          const activity = modelActivity(JSON.parse(line) as unknown);
          if (activity !== undefined) {
            activityChain = activityChain.then(async () => await request.onActivity(activity));
          }
        } catch {
          // Codex stdout is retained only in-memory and malformed activity is not published.
        }
      }
    };
    const flushActivity = (): void => {
      if (pending !== "") consume("\n");
    };
    const stopContainer = async (): Promise<void> => {
      let cid: string;
      try {
        cid = (await readFile(cidFile, "utf8")).trim();
      } catch {
        return;
      }
      if (/^[a-f0-9]{12,64}$/u.test(cid)) {
        await this.processRunner.run({
          command: this.dockerExecutable,
          args: ["stop", "--time", "2", cid],
          timeoutMs: 10_000,
        });
      }
    };
    const startedAt = new Date().toISOString();
    let result;
    try {
      result = await this.processRunner.run({
        command: this.dockerExecutable,
        args,
        cwd: workspace,
        timeoutMs: this.timeoutMs,
        maxOutputBytes: 16 * 1024 * 1024,
        signal: request.signal,
        onStdout: consume,
        onAbort: stopContainer,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      if (error instanceof ProductError) throw error;
      throw new ProductError("EXECUTOR_UNAVAILABLE", "isolated verification execution failed", {
        category: "INFRASTRUCTURE",
        retryable: true,
        cause: error,
      });
    }
    const completedAt = new Date().toISOString();
    flushActivity();
    await activityChain;
    let finalOutput = "";
    try {
      finalOutput = await readFile(outputFile, "utf8");
    } catch {
      // The caller classifies a successful process without output as UNKNOWN.
    }
    return { ...result, finalOutput, startedAt, completedAt };
  }
}
