import { mkdtemp, readFile } from "node:fs/promises";
import { request } from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { VerificationService, createIntentBenchServer } from "../src/index.js";
import { FakeModelRunner, supportingReview, writeFixtureZip } from "./test-support.js";
import { removeTestDirectory } from "../../product-core/test/temp-cleanup.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => removeTestDirectory(root)));
});

describe("IntentBench HTTP API", () => {
  it("accepts a bounded ZIP and exposes status, events, report, and both exports", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "intentbench-api-"));
    roots.push(root);
    const archivePath = path.join(root, "candidate.zip");
    await writeFixtureZip(
      path.resolve("packages/product-service/test/fixtures/synthetic-counter"),
      archivePath,
    );
    const service = new VerificationService({
      dataRoot: path.join(root, "data"),
      runner: new FakeModelRunner((input) =>
        Promise.resolve({
          rawReview: supportingReview(),
          startedAt: input.now(),
          completedAt: input.now(),
        }),
      ),
    });
    const server = createIntentBenchServer({
      liveVerificationEnabled: true,
      service,
      uploadRoot: path.join(root, "uploads"),
      maxArchiveBytes: 1024 * 1024,
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    const base = `http://127.0.0.1:${String(address.port)}`;
    try {
      const createdResponse = await fetch(`${base}/v1/runs`, {
        method: "POST",
        headers: { "content-type": "application/zip" },
        body: await readFile(archivePath),
      });
      expect(createdResponse.status).toBe(202);
      expect(
        (
          await fetch(`${base}/v1/runs`, {
            method: "POST",
            headers: { origin: "https://unrelated.example" },
          })
        ).status,
      ).toBe(403);
      const foreignHostStatus = await new Promise<number | undefined>((resolve, reject) => {
        const probe = request(base, { headers: { host: "unrelated.example" } }, (response) => {
          response.resume();
          resolve(response.statusCode);
        });
        probe.once("error", reject);
        probe.end();
      });
      expect(foreignHostStatus).toBe(403);
      const created = (await createdResponse.json()) as { runId: string };
      await service.waitForTerminal(created.runId);

      const history = (await (await fetch(`${base}/v1/runs`)).json()) as {
        runs: { runId: string }[];
      };
      expect(history.runs.map((run) => run.runId)).toEqual([created.runId]);
      const snapshot = (await (
        await fetch(`${base}/v1/runs/${created.runId}/snapshot`)
      ).json()) as { files: unknown[] };
      expect(snapshot.files).toHaveLength(4);
      const source = (await (
        await fetch(`${base}/v1/runs/${created.runId}/source?path=src%2Fcounter.ts`)
      ).json()) as { content: string };
      expect(source.content).toContain("export");
      expect(
        (await fetch(`${base}/v1/runs/${created.runId}/source?path=..%2Fmanifest.json`)).status,
      ).toBe(400);
      const settings = (await (await fetch(`${base}/v1/settings`)).json()) as { model: string };
      expect(settings.model).toBe("gpt-5.6-sol");
      expect(JSON.stringify(settings)).not.toContain("authFile");
      const diagnostic = (await (
        await fetch(`${base}/v1/diagnostics`, { method: "POST" })
      ).json()) as { available: boolean };
      expect(diagnostic.available).toBe(true);

      const status: unknown = await (await fetch(`${base}/v1/runs/${created.runId}`)).json();
      const events: unknown = await (await fetch(`${base}/v1/runs/${created.runId}/events`)).json();
      const report: unknown = await (await fetch(`${base}/v1/runs/${created.runId}/report`)).json();
      const jsonExport = await fetch(`${base}/v1/runs/${created.runId}/exports/report.json`);
      const markdownExport = await fetch(`${base}/v1/runs/${created.runId}/exports/report.md`);

      expect(status).toMatchObject({ outcome: "COMPLETE" });
      expect(Array.isArray((events as { events?: unknown }).events)).toBe(true);
      expect(report).toMatchObject({ verdict: "COMPLETE" });
      expect(jsonExport.headers.get("content-disposition")).toContain("attachment");
      expect(await markdownExport.text()).toContain("# IntentBench report");
    } finally {
      await service.shutdown();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("rejects oversized uploads before creating a run", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "intentbench-api-"));
    roots.push(root);
    const service = new VerificationService({
      dataRoot: path.join(root, "data"),
      runner: new FakeModelRunner(() => Promise.reject(new Error("must not execute"))),
    });
    const server = createIntentBenchServer({
      liveVerificationEnabled: true,
      service,
      uploadRoot: path.join(root, "uploads"),
      maxArchiveBytes: 8,
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    try {
      const response = await fetch(`http://127.0.0.1:${String(address.port)}/v1/runs`, {
        method: "POST",
        headers: { "content-type": "application/zip" },
        body: Buffer.alloc(32),
      });
      expect(response.status).toBe(413);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("cancels a live run through the API", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "intentbench-api-"));
    roots.push(root);
    const archivePath = path.join(root, "candidate.zip");
    await writeFixtureZip(
      path.resolve("packages/product-service/test/fixtures/synthetic-counter"),
      archivePath,
    );
    const service = new VerificationService({
      dataRoot: path.join(root, "data"),
      runner: new FakeModelRunner(
        async (input) =>
          await new Promise((resolve, reject) => {
            input.signal.addEventListener(
              "abort",
              () => reject(new DOMException("cancelled", "AbortError")),
              { once: true },
            );
            void resolve;
          }),
      ),
    });
    const server = createIntentBenchServer({
      liveVerificationEnabled: true,
      service,
      uploadRoot: path.join(root, "uploads"),
      maxArchiveBytes: 1024 * 1024,
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    const base = `http://127.0.0.1:${String(address.port)}`;
    try {
      const created = (await (
        await fetch(`${base}/v1/runs`, {
          method: "POST",
          headers: { "content-type": "application/zip" },
          body: await readFile(archivePath),
        })
      ).json()) as { runId: string };
      await service.waitForStatus(created.runId, "REVIEWING");

      const cancelled: unknown = await (
        await fetch(`${base}/v1/runs/${created.runId}/cancel`, { method: "POST" })
      ).json();

      expect(cancelled).toMatchObject({ status: "CANCELLED", outcome: "CANCELLED" });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
