import type { VerificationReport } from "../../product-core/src/schemas.js";
import type {
  VerificationActivityEvent,
  VerificationStatusView,
} from "../../product-service/src/contracts.js";
import { staticReplay, applicationBase } from "./edition.js";
import { ReplayData } from "./replay-data.js";

export type { VerificationReport, VerificationActivityEvent, VerificationStatusView };

export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  if (staticReplay) return (await new ReplayData(applicationBase).request(url, init)) as T;
  const response = await fetch(url, init);
  const data: unknown = await response.json();
  if (!response.ok) {
    const error = data as { error?: { message?: string } };
    throw new Error(error.error?.message ?? `Request failed (${String(response.status)})`);
  }
  return data as T;
}

const runPath = (runId: string): string => `/v1/runs/${encodeURIComponent(runId)}`;
export const api = {
  create: async (archive: File, specPath: string): Promise<VerificationStatusView> =>
    request("/v1/runs", {
      method: "POST",
      headers: { "content-type": "application/zip", "x-intentbench-spec-path": specPath },
      body: archive,
    }),
  status: async (id: string, signal?: AbortSignal): Promise<VerificationStatusView> =>
    request(runPath(id), signal ? { signal } : undefined),
  events: async (
    id: string,
    after: number,
    signal?: AbortSignal,
  ): Promise<{ events: VerificationActivityEvent[] }> =>
    request(`${runPath(id)}/events?after=${String(after)}`, signal ? { signal } : undefined),
  report: async (id: string, signal?: AbortSignal): Promise<VerificationReport> =>
    request(`${runPath(id)}/report`, signal ? { signal } : undefined),
  cancel: async (id: string): Promise<VerificationStatusView> =>
    request(`${runPath(id)}/cancel`, { method: "POST" }),
  exportUrl: (id: string, format: "json" | "md"): string => {
    if (staticReplay) throw new Error("Unavailable in static REPLAY. Use the recorded download.");
    return `${runPath(id)}/exports/report.${format}`;
  },
};

export function isTerminal(status: VerificationStatusView): boolean {
  return ["SUCCEEDED", "FAILED", "CANCELLED"].includes(status.status);
}
