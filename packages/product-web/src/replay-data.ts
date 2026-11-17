import type { ResearchStudy } from "../../product-service/src/research-archive.js";
import type { VerificationReport } from "../../product-core/src/schemas.js";

export interface ReplayAsset {
  path: string;
  sha256: string;
}
export interface ReplayManifest {
  schemaVersion: "1.0.0";
  mode: "REPLAY";
  catalog: { mode: "REPLAY"; studies: readonly { id: string; title: string; context: string }[] };
  studies: Record<string, ReplayAsset>;
  traces: Record<string, ReplayAsset>;
  acceptance: { report: ReplayAsset; markdown: ReplayAsset; provenance: string };
}
export interface ReplayTrace {
  mode: "REPLAY";
  id: string;
  sha256: string;
  lines: string[];
}

/** Only explicit static assets are reachable. There is no service fallback. */
export class ReplayData {
  constructor(
    private readonly base: string,
    private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {
    if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/u.test(base)) throw new Error("Invalid replay base path");
  }
  assetUrl(asset: ReplayAsset): string {
    if (
      !/^data\/[a-z0-9][a-z0-9.-]*\.(?:json|md)$/u.test(asset.path) ||
      !/^[a-f0-9]{64}$/u.test(asset.sha256)
    )
      throw new Error("Invalid replay asset");
    return `${this.base}${asset.path}`;
  }
  private async bytes(url: string, signal?: AbortSignal): Promise<Uint8Array<ArrayBuffer>> {
    const response = await this.fetcher(url, {
      credentials: "omit",
      redirect: "error",
      ...(signal ? { signal } : {}),
    });
    if (!response.ok) throw new Error(`Recorded evidence unavailable (${String(response.status)})`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > 16 * 1024 * 1024)
      throw new Error("Recorded evidence exceeds the read limit");
    return bytes;
  }
  async manifest(signal?: AbortSignal): Promise<ReplayManifest> {
    const candidate = JSON.parse(
      new TextDecoder().decode(await this.bytes(`${this.base}data/manifest.json`, signal)),
    ) as { schemaVersion: unknown; mode: unknown; catalog: { mode: unknown } };
    if (
      candidate.schemaVersion !== "1.0.0" ||
      candidate.mode !== "REPLAY" ||
      candidate.catalog.mode !== "REPLAY"
    )
      throw new Error("Unsupported replay manifest");
    const value = candidate as ReplayManifest;
    for (const asset of [
      ...Object.values(value.studies),
      ...Object.values(value.traces),
      value.acceptance.report,
      value.acceptance.markdown,
    ])
      this.assetUrl(asset);
    return value;
  }
  async read<T>(asset: ReplayAsset, signal?: AbortSignal): Promise<T> {
    const bytes = await this.bytes(this.assetUrl(asset), signal);
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
    if (hash !== asset.sha256) throw new Error("Recorded evidence failed its integrity check");
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  }
  async request(url: string, init?: RequestInit): Promise<unknown> {
    if ((init?.method ?? "GET").toUpperCase() !== "GET" || init?.body != null)
      throw new Error("Static REPLAY is read-only. Live execution is unavailable.");
    if (
      !/^\/v1\/(?:research(?:\/[a-z0-9.-]+)?|research-traces\/(?:V0|A1\.1)-CAND-\d{3}(?:\?offset=\d+)?)$/u.test(
        url,
      )
    )
      throw new Error("Unavailable in static REPLAY. No backend request was sent.");
    const signal = init?.signal ?? undefined;
    const manifest = await this.manifest(signal);
    if (url === "/v1/research") return manifest.catalog;
    const parsed = new URL(url, "https://replay.invalid");
    const id = parsed.pathname.split("/").at(-1) ?? "";
    if (parsed.pathname.startsWith("/v1/research/")) {
      const asset = Object.hasOwn(manifest.studies, id) ? manifest.studies[id] : undefined;
      if (!asset) throw new Error("Recorded study unavailable");
      return this.read<ResearchStudy>(asset, signal);
    }
    const asset = Object.hasOwn(manifest.traces, id) ? manifest.traces[id] : undefined;
    const offset = Number(parsed.searchParams.get("offset") ?? 0);
    if (!asset || !Number.isSafeInteger(offset) || offset < 0)
      throw new Error("Recorded trajectory unavailable");
    const trace = await this.read<ReplayTrace>(asset, signal);
    return {
      ...trace,
      offset,
      total: trace.lines.length,
      lines: trace.lines.slice(offset, offset + 10),
    };
  }
  async acceptance(signal?: AbortSignal) {
    const manifest = await this.manifest(signal);
    return {
      report: await this.read<VerificationReport>(manifest.acceptance.report, signal),
      provenance: manifest.acceptance.provenance,
      downloads: {
        json: this.assetUrl(manifest.acceptance.report),
        md: this.assetUrl(manifest.acceptance.markdown),
      },
    };
  }
}
