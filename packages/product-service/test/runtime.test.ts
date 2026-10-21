import os from "node:os";
import path from "node:path";
import { mkdtemp, rm, stat } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { createProductRuntime, loadProductRuntimeConfig } from "../src/runtime.js";

describe("public edition execution boundary", () => {
  it("starts recorded browsing without authentication or a Docker prerequisite", () => {
    expect(loadProductRuntimeConfig({}, process.cwd())).toMatchObject({
      mode: "recorded",
      authFile: null,
      host: "127.0.0.1",
      port: 4317,
    });
  });
  it("requires explicit live opt-in and dedicated authentication", () => {
    expect(() => loadProductRuntimeConfig({ INTENTBENCH_MODE: "live" }, process.cwd())).toThrow(
      "INTENTBENCH_AUTH_FILE is required",
    );
    expect(() => loadProductRuntimeConfig({ INTENTBENCH_MODE: "typo" }, process.cwd())).toThrow(
      "INTENTBENCH_MODE",
    );
  });
  it("rejects normal or ambient Codex authentication in live mode", () => {
    for (const home of [path.join(os.homedir(), ".codex"), path.resolve("ambient-home")])
      expect(() =>
        loadProductRuntimeConfig(
          {
            INTENTBENCH_MODE: "live",
            CODEX_HOME: home,
            INTENTBENCH_AUTH_FILE: path.join(home, "auth.json"),
          },
          process.cwd(),
        ),
      ).toThrow("isolated authentication home");
  });
  it("keeps loopback mandatory even when execution is disabled", () => {
    expect(() => loadProductRuntimeConfig({ INTENTBENCH_HOST: "0.0.0.0" }, process.cwd())).toThrow(
      "loopback",
    );
  });
  it("serves authentic research while rejecting uploads before intake in recorded mode", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "intentbench-public-mode-"));
    const config = loadProductRuntimeConfig({ INTENTBENCH_DATA_ROOT: root }, process.cwd());
    const { service, server } = createProductRuntime(config);
    try {
      await service.initialize();
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const base = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
      const settings = (await (await fetch(`${base}/v1/settings`)).json()) as Record<
        string,
        unknown
      >;
      expect(settings.liveVerificationEnabled).toBe(false);
      const research = await fetch(`${base}/v1/research/final-holdout-evaluation`);
      expect(research.status).toBe(200);
      const study = (await research.json()) as {
        mode: string;
        arms: { metrics: { correctCount: number } }[];
      };
      expect(study.mode).toBe("REPLAY");
      expect(study.arms.map((arm) => arm.metrics.correctCount)).toEqual([8, 8]);
      const rejected = await fetch(`${base}/v1/runs`, {
        method: "POST",
        headers: { "content-type": "application/zip" },
        body: "not executed",
      });
      expect(rejected.status).toBe(503);
      expect(await service.runStore.listRunIds()).toEqual([]);
      await expect(stat(config.uploadRoot)).rejects.toMatchObject({ code: "ENOENT" });
      expect((await service.checkExecutor()).available).toBe(false);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await service.shutdown();
      await rm(root, { recursive: true, force: true });
    }
  });
});
