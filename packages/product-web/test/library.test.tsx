// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { History, SourceFile } from "../src/library.js";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("bounds source DOM rendering and renders candidate markup as inert text", async () => {
  const content = Array.from({ length: 503 }, (_, index) =>
    index === 0 ? "<script>not executed</script>" : `line-${String(index + 1)}`,
  ).join("\n");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          relativePath: "many.txt",
          content,
          size: content.length,
          sha256: "abc",
        }),
    }),
  );
  const { container } = render(<SourceFile runId="run_fixture" file="many.txt" />);
  await screen.findByText("<script>not executed</script>");
  expect(container.querySelectorAll("script")).toHaveLength(0);
  expect(container.querySelectorAll(".source-line")).toHaveLength(500);
  fireEvent.click(screen.getByRole("button", { name: "Next lines" }));
  expect(container.querySelectorAll(".source-line")).toHaveLength(3);
  expect(screen.getByText("line-503")).toBeTruthy();
});
it("renders honest empty history and can retry a service failure", async () => {
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new Error("Service offline"))
    .mockResolvedValue({ ok: true, json: () => Promise.resolve({ runs: [], warnings: [] }) });
  vi.stubGlobal("fetch", fetcher);
  render(<History onOpen={() => undefined} />);
  expect((await screen.findByRole("alert")).textContent).toContain("Service offline");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("No verifications yet.")).toBeTruthy();
});
it("searches and filters real persisted runs and reopens a selected report", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          runs: [
            {
              runId: "run_alice",
              snapshotId: "sha256:abc",
              outcome: "COMPLETE",
              status: "SUCCEEDED",
              createdAt: "2026-10-18T12:00:00Z",
              updatedAt: "2026-10-18T12:01:00Z",
            },
            {
              runId: "run_bob",
              snapshotId: "sha256:def",
              outcome: "UNKNOWN",
              status: "FAILED",
              createdAt: "2026-10-17T12:00:00Z",
              updatedAt: "2026-10-17T12:01:00Z",
            },
          ],
          warnings: [],
        }),
    }),
  );
  const open = vi.fn();
  render(<History onOpen={open} />);
  await screen.findByRole("button", { name: "Open run_alice" });
  fireEvent.change(screen.getByLabelText("Search runs"), { target: { value: "alice" } });
  await waitFor(() => expect(screen.queryByRole("button", { name: "Open run_bob" })).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Open run_alice" }));
  expect(open).toHaveBeenCalledWith("run_alice");
  fireEvent.change(screen.getByLabelText("Outcome"), { target: { value: "UNKNOWN" } });
  expect(screen.getByText("No runs match these filters.")).toBeTruthy();
});
