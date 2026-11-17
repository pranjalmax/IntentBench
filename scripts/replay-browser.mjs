import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdtemp } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { chromium } from "playwright-core";
import AxeBuilder from "@axe-core/playwright";
import process from "node:process";

const root = path.resolve("dist/replay");
const evidence = JSON.parse(await readFile("docs/release/evidence/acceptance-report.json", "utf8"));
const screenshots = await mkdtemp(path.join(os.tmpdir(), "intentbench-replay-browser-"));
const server = createServer((request, response) => {
  void (async () => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (
        !["GET", "HEAD"].includes(request.method ?? "") ||
        !url.pathname.startsWith("/IntentBench/")
      ) {
        response.writeHead(404).end();
        return;
      }
      const relative =
        decodeURIComponent(url.pathname.slice("/IntentBench/".length)) || "index.html";
      const target = path.resolve(root, relative);
      if (!target.startsWith(root + path.sep)) {
        response.writeHead(404).end();
        return;
      }
      const data = await readFile(target);
      const mime = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".md": "text/markdown",
        ".svg": "image/svg+xml",
        ".woff2": "font/woff2",
      };
      response.writeHead(200, {
        "content-type": mime[path.extname(target)] ?? "application/octet-stream",
      });
      response.end(request.method === "HEAD" ? undefined : data);
    } catch {
      response.writeHead(404).end();
    }
  })();
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address !== "string");
const base = `http://127.0.0.1:${address.port}/IntentBench/`;
const browser = await chromium.launch({
  channel: process.env.INTENTBENCH_BROWSER ?? "chrome",
  headless: true,
});
const checks = [];
const errors = [];
const forbidden = [];
try {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  context.on("request", (request) => {
    const url = new URL(request.url());
    if (
      !["GET", "HEAD"].includes(request.method()) ||
      url.origin !== new URL(base).origin ||
      url.pathname.includes("/v1/") ||
      !url.pathname.startsWith("/IntentBench/")
    )
      forbidden.push({ url: request.url(), method: request.method() });
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto(base);
    assert.match(await page.title(), /IntentBench/);
    await page.getByRole("heading", { name: "Equal accuracy. Different errors." }).waitFor();
    assert.equal(await page.locator(".research-table tbody tr").count(), 12);
    await page
      .getByLabel("Recorded study", { exact: true })
      .selectOption("hard-dev-verification-baseline");
    await page.getByRole("heading", { name: "HARD-DEV / V0", exact: true }).waitFor();
    await page
      .getByLabel("Recorded study", { exact: true })
      .selectOption("final-holdout-evaluation");
    await page.getByLabel("Recorded trajectory", { exact: true }).selectOption("A1.1-CAND-007");
    await page.getByRole("heading", { name: "REPLAY · A1.1-CAND-007" }).waitFor();
    await page.getByRole("button", { name: "Next events" }).click();
    await page.getByText(/Recorded events 11–/).waitFor();
    await page.reload();
    await page.getByRole("heading", { name: "REPLAY · A1.1-CAND-007" }).waitFor();
    assert.equal(
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
        .violations.length,
      0,
    );
    const reportButton = page.getByRole("button", { name: "Acceptance report", exact: true });
    await reportButton.focus();
    await page.keyboard.press("Enter");
    await page.getByText("REPLAY / genuine saved acceptance evidence", { exact: true }).waitFor();
    const requirements = page.getByRole("navigation", { name: "Requirements", exact: true });
    if (width === 390)
      await requirements.getByRole("button", { name: /Choose requirement/ }).click();
    await requirements
      .getByRole("button", {
        name: `${evidence.review.requirements[0].id}: ${evidence.review.requirements[0].statement}`,
        exact: true,
      })
      .focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    assert.equal(
      new URL(page.url()).searchParams.get("requirement"),
      evidence.review.requirements[1].id,
    );
    await page.reload();
    await page
      .getByRole("heading", { name: evidence.review.requirements[1].statement, exact: true })
      .waitFor();
    const trail = page.getByRole("navigation", { name: "Requirement evidence trail" });
    await trail.getByRole("link").nth(1).click();
    await trail.getByRole("link").nth(2).click();
    for (const format of ["JSON", "Markdown"]) {
      const download = page.waitForEvent("download");
      await page.getByRole("link", { name: format, exact: true }).click();
      const file = await download;
      const downloaded = await readFile(await file.path(), "utf8");
      const original = await readFile(
        `docs/release/evidence/acceptance-report.${format === "JSON" ? "json" : "md"}`,
        "utf8",
      );
      assert.equal(downloaded.replaceAll("\r\n", "\n"), original.replaceAll("\r\n", "\n"));
    }
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      [],
    );
    assert.equal(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollWidth > globalThis.innerWidth,
      ),
      false,
    );
    await page.evaluate(() => globalThis.scrollTo(0, 0));
    await page.screenshot({ path: path.join(screenshots, `replay-${width}.png`), fullPage: false });
    await page.getByRole("button", { name: "Source availability", exact: true }).click();
    await page.getByRole("heading", { name: "The source snapshot is not published." }).waitFor();
    await page.getByRole("button", { name: "Demo details", exact: true }).click();
    await page.getByRole("heading", { name: "A static record. An inspectable result." }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Check isolation" }).count(), 0);
    await page.getByRole("button", { name: "New verification", exact: true }).click();
    await page.getByRole("heading", { name: "Live verification is disabled." }).waitFor();
    assert.equal(await page.getByLabel("Repository ZIP", { exact: true }).count(), 0);
    checks.push({
      width,
      studyComparison: true,
      tracePagination: true,
      directRefresh: true,
      keyboardRequirements: true,
      authenticDownloads: 2,
      axeViolations: axe.violations.length,
      uploads: false,
    });
  }
  const failure = await context.newPage();
  await failure.route("**/data/acceptance-report.json", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await failure.goto(`${base}?view=report`);
  await failure
    .getByRole("alert")
    .getByText(/integrity check/)
    .waitFor();
  await failure.close();
  assert.deepEqual(errors, []);
  assert.deepEqual(forbidden, []);
  process.stdout.write(
    JSON.stringify(
      {
        status: "PASS",
        checks,
        tamperedEvidenceRejected: true,
        forbiddenRequests: forbidden,
        consoleErrors: errors,
        screenshots,
        newModelCalls: 0,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
