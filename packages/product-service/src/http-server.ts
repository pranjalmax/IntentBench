import { randomUUID } from "node:crypto";
import { mkdir, open, rm } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import path from "node:path";

import { ProductError } from "../../product-core/src/index.js";
import type { VerificationService } from "./service.js";
import { serveProductWeb } from "./static-web.js";
import { ProductLibrary } from "./product-library.js";
import type { ResearchArchive } from "./research-archive.js";
import { frozenA11Profile } from "../../product-core/src/index.js";

export interface IntentBenchServerOptions {
  service: VerificationService;
  uploadRoot: string;
  maxArchiveBytes: number;
  webRoot?: string;
  research?: ResearchArchive;
  localAddress?: string;
  liveVerificationEnabled?: boolean;
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  const body = `${JSON.stringify(value)}\n`;
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(body);
}

function errorStatus(error: ProductError): number {
  if (error.code === "RUN_NOT_FOUND") return 404;
  if (error.code === "RUN_CONFLICT") return 409;
  if (error.code === "ARCHIVE_LIMIT_EXCEEDED") return 413;
  if (error.category === "INPUT" || error.category === "SECURITY") return 400;
  if (error.code === "EXECUTOR_UNAVAILABLE") return 503;
  return 500;
}

async function receiveArchive(
  request: IncomingMessage,
  target: string,
  maxBytes: number,
): Promise<void> {
  const declared = Number(request.headers["content-length"] ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new ProductError("ARCHIVE_LIMIT_EXCEEDED", "compressed archive exceeds the limit", {
      category: "INPUT",
    });
  }
  const handle = await open(target, "wx", 0o600);
  let total = 0;
  let exceeded = false;
  try {
    for await (const chunk of request) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
      total += bytes.byteLength;
      if (total > maxBytes) {
        exceeded = true;
        continue;
      }
      await handle.write(bytes);
    }
    await handle.sync();
  } finally {
    await handle.close();
  }
  if (exceeded) {
    throw new ProductError("ARCHIVE_LIMIT_EXCEEDED", "compressed archive exceeds the limit", {
      category: "INPUT",
    });
  }
  if (total === 0) {
    throw new ProductError("ARCHIVE_INVALID", "repository archive is empty", { category: "INPUT" });
  }
}

function routeRun(url: URL): { runId: string; suffix: string } | undefined {
  const match = /^\/v1\/runs\/([A-Za-z0-9][A-Za-z0-9._-]{0,127})(\/.*)?$/u.exec(url.pathname);
  if (match === null) return undefined;
  const runId = match[1];
  if (runId === undefined) return undefined;
  return { runId, suffix: match[2] ?? "" };
}

export function createIntentBenchServer(options: IntentBenchServerOptions): Server {
  const uploadRoot = path.resolve(options.uploadRoot);
  const library = new ProductLibrary(options.service);
  return createServer((request, response) => {
    void (async () => {
      try {
        const authority = new URL(`http://${request.headers.host ?? "localhost"}`);
        const origin = request.headers.origin;
        if (
          !["localhost", "127.0.0.1", "[::1]"].includes(authority.hostname) ||
          (origin !== undefined && origin !== authority.origin)
        ) {
          sendJson(response, 403, {
            error: { code: "REQUEST_ORIGIN_DENIED", message: "Use the local application origin." },
          });
          return;
        }
        const url = new URL(request.url ?? "/", "http://intentbench.local");
        if (request.method === "GET" && url.pathname === "/v1/runs") {
          sendJson(response, 200, await library.history());
          return;
        }
        if (request.method === "GET" && url.pathname === "/v1/settings") {
          sendJson(response, 200, {
            schemaVersion: "1.0.0",
            liveVerificationEnabled: options.liveVerificationEnabled === true,
            address: options.localAddress ?? "Loopback only",
            model: "gpt-5.6-sol",
            reasoning: "high",
            profile: frozenA11Profile,
            maxArchiveBytes: options.maxArchiveBytes,
            sourcePreviewBytes: 256 * 1024,
            isolation: "Pinned Linux Docker / workspace-only shell / shell network denied",
            storage: "Local immutable snapshots, durable runs and calibrated reports",
            configuration:
              "Read-only effective configuration. Change INTENTBENCH_HOST, INTENTBENCH_PORT or INTENTBENCH_DATA_ROOT at service launch. Authentication remains isolated and is never returned by this API.",
          });
          return;
        }
        if (request.method === "POST" && url.pathname === "/v1/diagnostics") {
          sendJson(response, 200, await options.service.checkExecutor());
          return;
        }
        if (request.method === "GET" && options.research && url.pathname === "/v1/research") {
          sendJson(response, 200, options.research.catalog());
          return;
        }
        const study = /^\/v1\/research\/([a-z0-9.-]+)$/u.exec(url.pathname);
        if (request.method === "GET" && options.research && study?.[1]) {
          sendJson(response, 200, await options.research.study(study[1]));
          return;
        }
        const trajectory = /^\/v1\/research-traces\/([A-Za-z0-9.-]+)$/u.exec(url.pathname);
        if (request.method === "GET" && options.research && trajectory?.[1]) {
          sendJson(
            response,
            200,
            await options.research.trajectory(
              trajectory[1],
              Number(url.searchParams.get("offset") ?? 0),
            ),
          );
          return;
        }
        if (
          request.method === "GET" &&
          options.webRoot &&
          !url.pathname.startsWith("/v1/") &&
          (await serveProductWeb(options.webRoot, url.pathname, response))
        )
          return;
        if (request.method === "POST" && url.pathname === "/v1/runs") {
          if (options.liveVerificationEnabled !== true) {
            sendJson(response, 503, {
              error: {
                code: "EXECUTOR_UNAVAILABLE",
                message: "Recorded-only mode: live verification is disabled.",
              },
            });
            return;
          }
          if (
            !(request.headers["content-type"] ?? "").toLowerCase().startsWith("application/zip")
          ) {
            sendJson(response, 415, {
              error: { code: "ARCHIVE_INVALID", message: "content-type must be application/zip" },
            });
            return;
          }
          await mkdir(uploadRoot, { recursive: true });
          const upload = path.join(uploadRoot, `upload-${randomUUID()}.zip`);
          try {
            await receiveArchive(request, upload, options.maxArchiveBytes);
            const specHeader = request.headers["x-intentbench-spec-path"];
            const specPath = Array.isArray(specHeader) ? specHeader[0] : specHeader;
            const created = await options.service.createRun({
              archivePath: upload,
              ...(specPath === undefined ? {} : { specPath }),
            });
            sendJson(response, 202, created);
          } finally {
            await rm(upload, { force: true }).catch(() => undefined);
          }
          return;
        }
        const route = routeRun(url);
        if (route === undefined) {
          sendJson(response, 404, { error: { code: "RUN_NOT_FOUND", message: "route not found" } });
          return;
        }
        if (request.method === "GET" && route.suffix === "") {
          sendJson(response, 200, await options.service.getStatus(route.runId));
          return;
        }
        if (request.method === "GET" && route.suffix === "/snapshot") {
          sendJson(response, 200, await library.snapshot(route.runId));
          return;
        }
        if (request.method === "GET" && route.suffix === "/source") {
          sendJson(
            response,
            200,
            await library.source(route.runId, url.searchParams.get("path") ?? ""),
          );
          return;
        }
        if (request.method === "GET" && route.suffix === "/events") {
          const after = Number(url.searchParams.get("after") ?? 0);
          if (!Number.isSafeInteger(after) || after < 0) {
            throw new ProductError("ARCHIVE_INVALID", "after must be a nonnegative integer", {
              category: "INPUT",
            });
          }
          sendJson(response, 200, { events: await options.service.getEvents(route.runId, after) });
          return;
        }
        if (request.method === "POST" && route.suffix === "/cancel") {
          sendJson(response, 202, await options.service.cancel(route.runId));
          return;
        }
        if (request.method === "GET" && route.suffix === "/report") {
          sendJson(response, 200, await options.service.getReport(route.runId));
          return;
        }
        if (request.method === "GET" && route.suffix === "/exports/report.json") {
          const body = await options.service.exportReport(route.runId, "json");
          response.writeHead(200, {
            "content-type": "application/json; charset=utf-8",
            "content-disposition": `attachment; filename="${route.runId}-intentbench-report.json"`,
            "content-length": Buffer.byteLength(body),
            "x-content-type-options": "nosniff",
          });
          response.end(body);
          return;
        }
        if (request.method === "GET" && route.suffix === "/exports/report.md") {
          const body = await options.service.exportReport(route.runId, "markdown");
          response.writeHead(200, {
            "content-type": "text/markdown; charset=utf-8",
            "content-disposition": `attachment; filename="${route.runId}-intentbench-report.md"`,
            "content-length": Buffer.byteLength(body),
            "x-content-type-options": "nosniff",
          });
          response.end(body);
          return;
        }
        sendJson(response, 404, { error: { code: "RUN_NOT_FOUND", message: "route not found" } });
      } catch (error) {
        if (response.headersSent) {
          response.destroy();
          return;
        }
        const productError =
          error instanceof ProductError
            ? error
            : new ProductError("INTERNAL_ERROR", "request failed unexpectedly", {
                category: "INTERNAL",
                cause: error,
              });
        sendJson(response, errorStatus(productError), { error: productError.toData() });
      }
    })();
  });
}
