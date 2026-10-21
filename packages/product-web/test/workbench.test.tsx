// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { VerificationStatusView } from "../../product-service/src/contracts.js";
import { Intake, outcomePresentation } from "../src/workbench.js";

afterEach(cleanup);

describe("verification workbench", () => {
  it.each([
    ["COMPLETE", "Complete"],
    ["INCOMPLETE", "Incomplete"],
    ["UNKNOWN", "Unknown"],
    ["INFRASTRUCTURE_FAILURE", "Error"],
    ["CANCELLED", "Cancelled"],
  ] as const)("keeps %s distinct", (outcome, expected) => {
    expect(outcomePresentation(outcome).label).toBe(expected);
  });

  it("submits the actual ZIP and chosen specification path, preventing duplicate submission", async () => {
    let resolve!: (value: VerificationStatusView) => void;
    const create = vi.fn(
      () =>
        new Promise<VerificationStatusView>((done) => {
          resolve = done;
        }),
    );
    const onCreated = vi.fn();
    render(<Intake create={create} onCreated={onCreated} />);
    const file = new File(["zip bytes"], "candidate.zip", { type: "application/zip" });
    fireEvent.change(screen.getByLabelText("Repository ZIP"), { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText(/Specification path/), {
      target: { value: "docs/SPEC.md" },
    });
    fireEvent.click(screen.getByRole("button", { name: /start verification/i }));
    expect(create).toHaveBeenCalledWith(file, "docs/SPEC.md");
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: /creating snapshot/i }).disabled,
    ).toBe(true);
    resolve({ runId: "run_test" } as VerificationStatusView);
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("run_test"));
  });

  it("preserves input and explains a backend rejection without inventing a run", async () => {
    const create = vi.fn().mockRejectedValue(new Error("Archive exceeds the limit"));
    const onCreated = vi.fn();
    render(<Intake create={create} onCreated={onCreated} />);
    fireEvent.change(screen.getByLabelText("Repository ZIP"), {
      target: { files: [new File(["x"], "repo.zip")] },
    });
    fireEvent.click(screen.getByRole("button", { name: /start verification/i }));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Archive exceeds the limit",
    );
    expect(onCreated).not.toHaveBeenCalled();
    expect(screen.getByText("repo.zip")).toBeTruthy();
  });

  it.each([
    new File(["not a ZIP"], "replacement.txt", { type: "text/plain" }),
    new File([new Uint8Array(10 * 1024 * 1024 + 1)], "too-large.zip", { type: "application/zip" }),
  ])("does not submit the previous repository after rejecting a replacement", (rejected) => {
    const create = vi.fn().mockResolvedValue({ runId: "must_not_be_created" });
    render(<Intake create={create} onCreated={() => undefined} />);
    const picker = screen.getByLabelText("Repository ZIP");
    fireEvent.change(picker, { target: { files: [new File(["valid bytes"], "previous.zip")] } });
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: /start verification/i }).disabled,
    ).toBe(false);
    fireEvent.change(picker, { target: { files: [rejected] } });
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: /start verification/i }).disabled,
    ).toBe(true);
    expect(screen.queryByText("previous.zip")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /start verification/i }));
    expect(create).not.toHaveBeenCalled();
  });
});
