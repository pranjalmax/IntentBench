import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import AxeBuilder from "@axe-core/playwright";
import process from "node:process";

const base = process.env.INTENTBENCH_WEB_URL ?? "http://127.0.0.1:4320";
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(new URL(base).hostname));
const browser = await chromium.launch({
  channel: process.env.INTENTBENCH_BROWSER ?? "chrome",
  headless: true,
});
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const checks = [];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(base);
    const icon = await page.request.get(new URL("/assets/mark.svg", base).href);
    assert.equal(icon.status(), 200);
    assert.match(icon.headers()["content-type"], /image\/svg\+xml/);
    await page.getByText(/Recorded-only edition/).waitFor();
    await page.getByRole("heading", { name: "Equal accuracy. Different errors." }).waitFor();
    assert.equal(await page.locator(".research-table tbody tr").count(), 12);
    await page.getByLabel("Recorded trajectory", { exact: true }).selectOption("A1.1-CAND-007");
    await page.getByRole("heading", { name: "REPLAY · A1.1-CAND-007" }).waitFor();
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      axe.violations.map((v) => v.id),
      [],
    );
    assert.equal(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollWidth > globalThis.innerWidth,
      ),
      false,
    );
    await page.getByRole("button", { name: "New verification", exact: true }).click();
    await page.getByRole("heading", { name: "Live verification is disabled." }).waitFor();
    assert.equal(await page.getByLabel("Repository ZIP", { exact: true }).count(), 0);
    await page.getByRole("button", { name: "Browse recorded research", exact: true }).click();
    await page.getByRole("heading", { name: "Equal accuracy. Different errors." }).waitFor();
    checks.push({ width, replay: true, noUploadForm: true, axeViolations: axe.violations.length });
  }
  assert.deepEqual(errors, []);
  process.stdout.write(
    `${JSON.stringify({ mode: "RECORDED_ONLY_BROWSER_VALIDATION", checks, pageErrors: errors, newModelCalls: 0 }, null, 2)}\n`,
  );
} finally {
  await browser.close();
}
