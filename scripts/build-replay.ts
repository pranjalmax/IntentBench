import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import evidence from "../docs/release/evidence-manifest.json" with { type: "json" };
import { ResearchArchive } from "../packages/product-service/src/research-archive.js";
import { readVerifiedFile } from "../packages/product-service/src/read-only-files.js";
import type { ReplayAsset, ReplayManifest } from "../packages/product-web/src/replay-data.js";

/** Build trusted published data only. Never imports or executes candidate code. */
export async function collectReplayAssets(root: string): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>();
  const add = (name: string, data: Buffer): ReplayAsset => {
    if (!/^data\/[a-z0-9][a-z0-9.-]*\.(?:json|md)$/u.test(name) || files.has(name))
      throw new Error("Invalid or duplicate replay asset");
    files.set(name, data);
    return { path: name, sha256: createHash("sha256").update(data).digest("hex") };
  };
  const json = (name: string, value: unknown) =>
    add(name, Buffer.from(`${JSON.stringify(value)}\n`));
  const archive = new ResearchArchive(root);
  const catalog = archive.catalog();
  const manifest: ReplayManifest = {
    schemaVersion: "1.0.0",
    mode: "REPLAY",
    catalog,
    studies: {},
    traces: {},
    acceptance: {
      report: { path: "", sha256: "" },
      markdown: { path: "", sha256: "" },
      provenance:
        "Genuine saved local acceptance report. REPLAY only; no new verification occurred.",
    },
  };
  for (const item of catalog.studies) {
    const study = await archive.study(item.id);
    manifest.studies[item.id] = json(`data/${item.id}.json`, study);
    for (const trace of study.traces) {
      const lines: string[] = [];
      let page;
      do {
        page = await archive.trajectory(trace.id, lines.length);
        lines.push(...page.lines);
      } while (lines.length < page.total);
      manifest.traces[trace.id] = json(`data/${trace.id.toLowerCase()}.json`, {
        mode: "REPLAY",
        id: trace.id,
        sha256: trace.sha256,
        lines,
      });
    }
  }
  for (const format of ["json", "md"] as const) {
    const source = `docs/release/evidence/acceptance-report.${format}`;
    const pin = evidence.assets.find((asset) => asset.path === source);
    if (!pin) throw new Error("Acceptance evidence is not allowlisted");
    const data = await readVerifiedFile(root, source, 1024 * 1024, pin.sha256, true);
    const asset = add(
      `data/acceptance-report.${format}`,
      Buffer.from(data.toString("utf8").replaceAll("\r\n", "\n")),
    );
    if (format === "json") manifest.acceptance.report = asset;
    else manifest.acceptance.markdown = asset;
  }
  json("data/manifest.json", manifest);
  return files;
}

async function main() {
  const root = process.cwd();
  const files = await collectReplayAssets(root);
  const destination = path.resolve(root, "dist/replay");
  await mkdir(path.join(destination, "data"), { recursive: true });
  for (const [name, data] of files)
    await writeFile(path.join(destination, name), data, { flag: "wx" });
  await writeFile(path.join(destination, ".nojekyll"), "");
  console.log(
    `Static REPLAY: ${String(files.size)} verified data assets; no backend or live execution.`,
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
