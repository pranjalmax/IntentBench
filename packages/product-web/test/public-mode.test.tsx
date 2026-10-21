// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "../src/workbench.js";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("does not claim a confirmed recorded mode when service configuration is unavailable", async () => {
  window.history.replaceState({}, "", "/?view=verification");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  render(<App />);
  expect(await screen.findByText(/Execution mode unavailable/)).toBeTruthy();
  expect(screen.queryByLabelText("Repository ZIP")).toBeNull();
});
it.each([false, "false", null])(
  "never enables uploads unless service capability is literally true: %s",
  async (capability) => {
    window.history.replaceState({}, "", "/?view=verification");
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ liveVerificationEnabled: capability }),
      }),
    );
    render(<App />);
    expect(await screen.findByText(/Recorded-only edition/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "New verification" }));
    expect(screen.queryByLabelText("Repository ZIP")).toBeNull();
    expect(screen.getByText(/Live verification is disabled/)).toBeTruthy();
  },
);
