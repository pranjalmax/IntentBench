import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { expect, it } from "vitest";
import { collectReplayAssets } from "../../../scripts/build-replay.js";
import { ReplayData, type ReplayManifest } from "../src/replay-data.js";
import published from "../../product-service/research-manifest.json" with { type: "json" };
import type { ResearchStudy } from "../../product-service/src/research-archive.js";

it("preserves authentic evidence, hashes, comparisons and exports through the static adapter", async () => {
  const assets = await collectReplayAssets(process.cwd());
  const calls: string[] = [];
  const fetcher: typeof fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);
    expect(init?.credentials).toBe("omit");
    expect(url.startsWith("/IntentBench/data/")).toBe(true);
    const data = assets.get(url.slice("/IntentBench/".length));
    return Promise.resolve(
      new Response(data ? new Uint8Array(data) : null, { status: data ? 200 : 404 }),
    );
  };
  const adapter = new ReplayData("/IntentBench/", fetcher);
  const manifest = await adapter.manifest();
  expect(manifest.catalog.studies).toHaveLength(6);
  expect(Object.keys(manifest.traces)).toHaveLength(6);
  for (const asset of [
    ...Object.values(manifest.studies),
    ...Object.values(manifest.traces),
    manifest.acceptance.report,
    manifest.acceptance.markdown,
  ]) {
    expect(
      createHash("sha256")
        .update(assets.get(asset.path) ?? "")
        .digest("hex"),
    ).toBe(asset.sha256);
  }
  const study = (await adapter.request("/v1/research/final-holdout-evaluation")) as ResearchStudy;
  expect(study.rows).toHaveLength(12);
  expect(study.arms.map((arm) => arm.metrics.correctCount)).toEqual([8, 8]);
  const trace = (await adapter.request("/v1/research-traces/A1.1-CAND-007?offset=10")) as {
    lines: string[];
    offset: number;
    mode: string;
  };
  expect(trace.offset).toBe(10);
  expect(trace.mode).toBe("REPLAY");
  expect(trace.lines.length).toBeGreaterThan(0);
  const acceptance = await adapter.acceptance();
  expect(acceptance.report).toEqual(
    JSON.parse(await readFile("docs/release/evidence/acceptance-report.json", "utf8")),
  );
  expect(acceptance.downloads.md).toBe("/IntentBench/data/acceptance-report.md");
  expect(assets.get("data/acceptance-report.md")?.toString()).toBe(
    (await readFile("docs/release/evidence/acceptance-report.md", "utf8")).replaceAll("\r\n", "\n"),
  );
  expect(calls.every((url) => !url.includes("/v1/") && !url.includes("localhost"))).toBe(true);
});

it("fails on changed static evidence and never retries a live endpoint", async () => {
  const assets = await collectReplayAssets(process.cwd());
  const calls: string[] = [];
  const adapter = new ReplayData("/IntentBench/", (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);
    const data = url.endsWith("manifest.json")
      ? assets.get("data/manifest.json")?.toString()
      : "{}";
    return Promise.resolve(new Response(data));
  });
  await expect(adapter.acceptance()).rejects.toThrow("integrity check");
  expect(calls).toEqual([
    "/IntentBench/data/manifest.json",
    "/IntentBench/data/acceptance-report.json",
  ]);
});

it("rejects external, traversal and unsupported asset URLs before fetching", () => {
  const adapter = new ReplayData("/IntentBench/");
  for (const file of [
    "https://example.com/secret.json",
    "data/../secret.json",
    "data/%2e%2e.json",
    "data/runtime.js",
    "/v1/runs",
  ]) {
    expect(() => adapter.assetUrl({ path: file, sha256: "a".repeat(64) })).toThrow();
  }
});

it("does not build a replay artifact if original acceptance evidence has been tampered with", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "intentbench-replay-build-"));
  try {
    for (const relative of [
      ...published.files.map((file) => file.path),
      "docs/release/evidence/acceptance-report.json",
      "docs/release/evidence/acceptance-report.md",
    ]) {
      const destination = path.join(root, relative);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, await readFile(relative));
    }
    await writeFile(path.join(root, "docs/release/evidence/acceptance-report.json"), "{}");
    await expect(collectReplayAssets(root)).rejects.toThrow("integrity");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("rejects a manifest that tries to redirect an asset off the static allowlist", async () => {
  const assets = await collectReplayAssets(process.cwd());
  const manifest = JSON.parse(
    assets.get("data/manifest.json")?.toString() ?? "{}",
  ) as ReplayManifest;
  manifest.acceptance.report.path = "https://example.com/report.json";
  let requests = 0;
  const adapter = new ReplayData("/IntentBench/", () => {
    requests++;
    return Promise.resolve(new Response(JSON.stringify(manifest)));
  });
  await expect(adapter.acceptance()).rejects.toThrow("Invalid replay asset");
  expect(requests).toBe(1);
});
