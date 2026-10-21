import { readFile, realpath } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import path from "node:path";

const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
};

/** Serves only the built application. Candidate snapshots and runtime data are never a web root. */
export async function serveProductWeb(
  root: string,
  pathname: string,
  response: ServerResponse,
): Promise<boolean> {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return false;
  }
  if (decoded.includes("\\") || decoded.includes("\0")) return false;
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\//u, "");
  if (relative !== "index.html" && !relative.startsWith("assets/")) return false;
  try {
    const resolvedRoot = await realpath(root);
    const file = await realpath(path.resolve(resolvedRoot, relative));
    const contained = path.relative(resolvedRoot, file);
    if (contained.startsWith("..") || path.isAbsolute(contained)) return false;
    const contentType = mime[path.extname(file)];
    if (!contentType) return false;
    const body = await readFile(file);
    response.writeHead(200, {
      "content-type": contentType,
      "content-length": body.length,
      "cache-control": "no-cache",
      "x-content-type-options": "nosniff",
      "content-security-policy":
        "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      "referrer-policy": "no-referrer",
    });
    response.end(body);
    return true;
  } catch {
    return false;
  }
}
