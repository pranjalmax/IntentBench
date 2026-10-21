import { describe, expect, it } from "vitest";

import { NodeProcessRunner } from "../src/index.js";

describe("NodeProcessRunner", () => {
  it("terminates a process whose captured output exceeds the configured bound", async () => {
    await expect(
      new NodeProcessRunner().run({
        command: process.execPath,
        args: ["-e", "process.stdout.write('x'.repeat(4096))"],
        maxOutputBytes: 64,
        timeoutMs: 5_000,
      }),
    ).rejects.toThrow("process output exceeded the limit");
  });
});
