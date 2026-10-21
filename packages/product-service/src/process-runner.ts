import { spawn } from "node:child_process";

export interface ProcessInvocation {
  command: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  maxOutputBytes?: number;
  signal?: AbortSignal;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
  onAbort?: () => Promise<void>;
}

export interface ProcessResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export interface ProcessRunner {
  run(invocation: ProcessInvocation): Promise<ProcessResult>;
}

export class NodeProcessRunner implements ProcessRunner {
  async run(invocation: ProcessInvocation): Promise<ProcessResult> {
    const wasAborted = (): boolean => invocation.signal?.aborted === true;
    if (wasAborted()) throw new DOMException("aborted", "AbortError");
    const child = spawn(invocation.command, invocation.args, {
      cwd: invocation.cwd,
      env: invocation.env,
      shell: false,
      windowsHide: true,
    });
    child.stdin.end();
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let capturedBytes = 0;
    const outputState = { exceeded: false };
    let abortWork: Promise<void> | undefined;
    const stop = (timeout: boolean): void => {
      if (abortWork !== undefined) return;
      timedOut = timeout;
      abortWork = (async () => {
        await invocation.onAbort?.().catch(() => undefined);
        child.kill();
      })();
    };
    const onAbort = (): void => stop(false);
    invocation.signal?.addEventListener("abort", onAbort, { once: true });
    const timeout = setTimeout(() => stop(true), invocation.timeoutMs ?? 900_000);
    const capture = (chunk: string, stream: "stdout" | "stderr"): void => {
      if (outputState.exceeded) return;
      const chunkBytes = Buffer.byteLength(chunk, "utf8");
      const maxOutputBytes = invocation.maxOutputBytes ?? 16 * 1024 * 1024;
      if (capturedBytes + chunkBytes > maxOutputBytes) {
        outputState.exceeded = true;
        stop(false);
        return;
      }
      capturedBytes += chunkBytes;
      if (stream === "stdout") {
        stdout += chunk;
        invocation.onStdout?.(chunk);
      } else {
        stderr += chunk;
        invocation.onStderr?.(chunk);
      }
    };
    child.stdout.on("data", (chunk: string) => capture(chunk, "stdout"));
    child.stderr.on("data", (chunk: string) => capture(chunk, "stderr"));
    try {
      const result = await new Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>(
        (resolve, reject) => {
          child.on("error", reject);
          child.on("close", (exitCode, signal) => resolve({ exitCode, signal }));
        },
      );
      await abortWork;
      if (outputState.exceeded) throw new Error("process output exceeded the limit");
      if (wasAborted()) throw new DOMException("aborted", "AbortError");
      return { ...result, stdout, stderr, timedOut };
    } finally {
      clearTimeout(timeout);
      invocation.signal?.removeEventListener("abort", onAbort);
    }
  }
}
