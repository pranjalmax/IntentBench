import { expect, it } from "vitest";
import { ResearchArchive } from "../src/research-archive.js";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
it("reads frozen results with accurate denominators and labels every trajectory as replay", async () => {
  const archive = new ResearchArchive(process.cwd());
  const study = await archive.study("final-holdout-evaluation");
  expect(study.arms.map((arm) => arm.metrics.correctCount)).toEqual([8, 8]);
  expect(study.rows).toHaveLength(12);
  expect(study.traces).toHaveLength(6);
  const trace = await archive.trajectory("V0-CAND-003", 0);
  expect(trace.mode).toBe("REPLAY");
  expect(trace.lines[0]).toContain("thread.started");
  await expect(archive.trajectory("../private", 0)).rejects.toThrow();
  await expect(archive.study("../private")).rejects.toThrow();
  for (const entry of archive.catalog().studies) {
    const historical = await archive.study(entry.id);
    expect(historical.rows.length).toBeGreaterThan(0);
    expect(historical.mode).toBe("REPLAY");
  }
  for (const entry of study.traces) {
    const replay = await archive.trajectory(entry.id, 0);
    expect(replay.sha256).toBe(entry.sha256);
    expect(replay.lines.length).toBeGreaterThan(0);
  }
});
it("fails closed on an altered published result without rewriting historical evidence", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "intentbench-research-tamper-"));
  try {
    const destination = path.join(root, "research/results");
    await mkdir(destination, { recursive: true });
    await writeFile(
      path.join(destination, "final-holdout-evaluation.json"),
      JSON.stringify({ arms: { V0: { metrics: { correctCount: 12 } } } }),
    );
    await expect(new ResearchArchive(root).study("final-holdout-evaluation")).rejects.toThrow(
      "integrity",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
