import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { serveProductWeb } from "../src/static-web.js";

it("serves only built assets, with a restrictive policy and no data-directory fallback", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "intentbench-web-"));
  const webRoot = path.join(root, "web");
  await mkdir(path.join(webRoot, "assets"), { recursive: true });
  await writeFile(path.join(webRoot, "index.html"), "<h1>IntentBench</h1>");
  await writeFile(path.join(webRoot, "assets", "app.js"), "console.log('app');");
  await writeFile(path.join(root, "secret.json"), '{"private":true}');
  const server = createServer((request, response) => {
    void serveProductWeb(webRoot, request.url ?? "/", response).then((served) => {
      if (!served) {
        response.writeHead(404);
        response.end();
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
  try {
    const index = await fetch(base);
    expect(await index.text()).toContain("IntentBench");
    expect(index.headers.get("content-security-policy")).toContain("script-src 'self'");
    expect((await fetch(`${base}/assets/app.js`)).headers.get("content-type")).toContain(
      "javascript",
    );
    for (const unsafe of [
      "/secret.json",
      "/assets/%2e%2e%2f%2e%2e%2fsecret.json",
      "/assets/%5c..%5csecret.json",
      "/assets/%00.js",
      "/.intentbench-data/report.json",
    ]) {
      expect((await fetch(`${base}${unsafe}`)).status).toBe(404);
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(root, { recursive: true, force: true });
  }
});
