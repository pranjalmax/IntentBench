import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it.each(["/v1/runs", "/v1/diagnostics", "/v1/runs/saved/cancel"])(
  "never sends a hosted write to %s, regardless of service capabilities",
  async (url) => {
    vi.stubGlobal("__INTENTBENCH_STATIC_REPLAY__", true);
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => ({ liveVerificationEnabled: true }) });
    vi.stubGlobal("fetch", fetcher);
    const { request } = await import("../src/api.js");
    await expect(request(url, { method: "POST" })).rejects.toThrow("Static REPLAY is read-only");
    expect(fetcher).not.toHaveBeenCalled();
  },
);

it("fails closed on unsupported hosted routes instead of falling back to a backend", async () => {
  vi.stubGlobal("__INTENTBENCH_STATIC_REPLAY__", true);
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: () => ({}) });
  vi.stubGlobal("fetch", fetcher);
  const { request } = await import("../src/api.js");
  await expect(request("/v1/settings")).rejects.toThrow("Unavailable in static REPLAY");
  expect(fetcher).not.toHaveBeenCalled();
});

it("cannot construct a local API export link in the hosted edition", async () => {
  vi.stubGlobal("__INTENTBENCH_STATIC_REPLAY__", true);
  const { api } = await import("../src/api.js");
  expect(() => api.exportUrl("saved", "json")).toThrow("Unavailable in static REPLAY");
});
