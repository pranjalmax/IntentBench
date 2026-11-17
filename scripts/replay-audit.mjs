import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { scanText } from "./public-audit-lib.mjs";

const root = path.resolve("dist/replay");
const json = async (file) => JSON.parse(await readFile(path.join(root, file), "utf8"));
const manifest = await json("data/manifest.json");
assert.equal(manifest.mode, "REPLAY");
assert.equal(manifest.schemaVersion, "1.0.0");
assert.equal(manifest.catalog.studies.length, 6);
assert.equal(Object.keys(manifest.traces).length, 6);
const assets = [
  ...Object.values(manifest.studies),
  ...Object.values(manifest.traces),
  manifest.acceptance.report,
  manifest.acceptance.markdown,
];
const dataFiles = new Set(["data/manifest.json"]);
for (const asset of assets) {
  assert.match(asset.path, /^data\/[a-z0-9][a-z0-9.-]*\.(?:json|md)$/u);
  dataFiles.add(asset.path);
  assert.equal(
    createHash("sha256")
      .update(await readFile(path.join(root, asset.path)))
      .digest("hex"),
    asset.sha256,
  );
}
const files = [];
async function walk(directory) {
  for (const name of await readdir(directory)) {
    const target = path.join(directory, name);
    const stats = await lstat(target);
    assert.ok(!stats.isSymbolicLink(), "Linked static artifact");
    if (stats.isDirectory()) {
      await walk(target);
      continue;
    }
    assert.ok(stats.isFile() && stats.nlink === 1, "Unsupported static artifact");
    const relative = path.relative(root, target).split(path.sep).join("/");
    assert.ok(
      ["index.html", ".nojekyll"].includes(relative) ||
        dataFiles.has(relative) ||
        /^assets\/[A-Za-z0-9_.-]+\.(?:js|css|woff2|svg)$/u.test(relative),
      "Unexpected static artifact: " + relative,
    );
    files.push(relative);
    if (!relative.endsWith(".woff2"))
      assert.deepEqual(
        scanText(await readFile(target, "utf8")),
        [],
        "Static privacy finding: " + relative,
      );
  }
}
await walk(root);
for (const file of dataFiles) assert.ok(files.includes(file));
const index = await readFile(path.join(root, "index.html"), "utf8");
assert.ok(index.includes("/IntentBench/assets/"));
assert.ok(index.replaceAll("&#39;", "'").includes("form-action 'none'"));
assert.ok(
  index.indexOf("Content-Security-Policy") < index.indexOf("<script"),
  "CSP must precede executable resources",
);
const evidence = JSON.parse(await readFile("docs/release/evidence-manifest.json", "utf8"));
for (const format of ["json", "md"]) {
  const source = `docs/release/evidence/acceptance-report.${format}`;
  const pin = evidence.assets.find((asset) => asset.path === source);
  assert.ok(pin);
  assert.equal(
    createHash("sha256")
      .update(
        (await readFile(path.join(root, `data/acceptance-report.${format}`), "utf8")).replaceAll(
          "\r\n",
          "\n",
        ),
      )
      .digest("hex"),
    pin.sha256,
  );
}
const study = await json(manifest.studies["final-holdout-evaluation"].path);
assert.deepEqual(
  study.arms.map((arm) => arm.metrics.correctCount),
  [8, 8],
);
process.stdout.write(
  JSON.stringify(
    {
      status: "PASS",
      files: files.length,
      verifiedDataFiles: dataFiles.size,
      privacyFindings: [],
      liveBackendIncluded: false,
      originalExportsMatch: true,
      finalAccuracy: { V0: "8/12", A11: "8/12" },
    },
    null,
    2,
  ) + "\n",
);
