// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { calibrateReview } from "../../advanced-verifier/src/gate.js";
import { supportingReview, contradictoryReview } from "../../product-service/test/test-support.js";
import { api, type VerificationReport, type VerificationStatusView } from "../src/api.js";
import { EvidenceReport, RunView } from "../src/workbench.js";

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("matchMedia", (query: string) => ({
    media: query,
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

it("follows an inconclusive record across requirements, exposes its reproduction, and excludes it from coverage", async () => {
  const raw = supportingReview();
  const original = raw.requirements[0];
  if (!original) throw new Error("Missing synthetic requirement");
  raw.requirements.push({
    ...original,
    id: "R2",
    statement: "Return the exact incremented value.",
  });
  raw.proofObligations.push({
    requirementId: "R2",
    proposition: "Value equals current plus amount.",
    evidencePlan: "Execute the increment.",
  });
  raw.evidence.push({
    id: "E2",
    requirementIds: ["R2"],
    evidenceType: "VISIBLE_TEST",
    reproduction: "npm test",
    observedBehavior: "No tests found; no assertion ran.",
    disposition: "INCONCLUSIVE",
  });
  const review = calibrateReview(supportingReview());
  review.requirements = raw.requirements;
  review.proofObligations = raw.proofObligations;
  review.evidence = raw.evidence;
  render(<EvidenceReport report={{ runId: "run_inconclusive", review } as VerificationReport} />);
  expect(screen.getByText("1/2")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Inspect inconclusive evidence E2" }));
  expect(screen.getByRole("heading", { name: "Return the exact incremented value." })).toBeTruthy();
  await waitFor(() => expect(document.activeElement?.id).toBe("evidence-E2"));
  expect(document.querySelector<HTMLDetailsElement>("#evidence-E2 details")?.open).toBe(true);
  expect(
    screen.getByText(
      "This check did not establish support or contradiction. It is excluded from decisive coverage.",
    ),
  ).toBeTruthy();
  expect(screen.getAllByText("Coverage unresolved").length).toBeGreaterThan(0);
});

it("moves requirement selection with arrow keys and preserves the exact proof/evidence links", () => {
  const review = calibrateReview(supportingReview());
  const first = review.requirements[0];
  if (!first) throw new Error("Missing synthetic requirement");
  review.requirements.push({ ...first, id: "R2", statement: "Another explicit requirement." });
  render(<EvidenceReport report={{ runId: "run_keyboard", review } as VerificationReport} />);
  const button = screen.getByRole("button", { name: /^R1:/ });
  button.focus();
  fireEvent.keyDown(button, { key: "ArrowDown" });
  expect(screen.getByRole("button", { name: /^R2:/ }).getAttribute("aria-current")).toBe("true");
  expect(document.activeElement).toBe(screen.getByRole("button", { name: /^R2:/ }));
  expect(screen.getByRole("link", { name: /02 Proof/ }).getAttribute("href")).toBe("#proof-R2");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("shows a calibrated INCOMPLETE finding with expected, observed and reproduction evidence", () => {
  const report = {
    runId: "run_contradiction",
    review: calibrateReview(contradictoryReview()),
  } as VerificationReport;
  expect(report.review.verdict).toBe("INCOMPLETE");
  render(<EvidenceReport report={report} />);
  expect(screen.getByText("Contradiction found")).toBeTruthy();
  expect(
    screen.getByRole("heading", {
      name: "The implementation mutates the caller-owned current object.",
    }),
  ).toBeTruthy();
  expect(screen.getByText("Expected")).toBeTruthy();
  expect(
    screen.getAllByText("The candidate attempted to assign to current.value.").length,
  ).toBeGreaterThan(0);
});

it("keeps advisories with no matching requirement visible without turning them into blockers", () => {
  const review = calibrateReview(supportingReview());
  const finding = contradictoryReview().proposedFindings[0];
  if (!finding) throw new Error("Synthetic finding is missing.");
  review.advisories.push({
    ...finding,
    requirementId: "R999",
    claim: "Consider a richer error message.",
    calibratedSeverity: "ADVISORY",
    calibrationReason: "No explicit requirement maps to this concern.",
  });
  render(<EvidenceReport report={{ runId: "run_advisory", review } as VerificationReport} />);
  expect(screen.getByRole("heading", { name: "General advisories" })).toBeTruthy();
  expect(screen.getByText("Consider a richer error message.")).toBeTruthy();
  expect(screen.queryByText("Contradiction found")).toBeNull();
});

it("navigates requirement IDs to the corresponding obligations and evidence; renders untrusted text literally", () => {
  const review = supportingReview();
  const original = review.requirements[0];
  if (!original) throw new Error("Synthetic requirement is missing.");
  review.requirements.push({
    ...original,
    id: "R2",
    statement: "Reject a negative amount.",
    observableSuccessCondition: "Throws RangeError.",
  });
  review.proofObligations.push({
    requirementId: "R2",
    proposition: "Negative input is rejected.",
    evidencePlan: "Call with -1.",
  });
  review.evidence.push({
    id: "E2",
    requirementIds: ["R2"],
    evidenceType: "TARGETED_RUNTIME",
    reproduction: "advanceCounter({value:0}, -1)",
    observedBehavior: "<script>unsafe()</script> was text, not execution.",
    disposition: "SUPPORTS",
  });
  const report = { runId: "run_synthetic", review: calibrateReview(review) } as VerificationReport;
  render(<EvidenceReport report={report} />);
  expect(screen.queryByText("<script>unsafe()</script> was text, not execution.")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /R2: Reject/ }));
  expect(screen.getByRole("heading", { name: "Reject a negative amount." })).toBeTruthy();
  expect(screen.getByText("<script>unsafe()</script> was text, not execution.")).toBeTruthy();
  expect(document.querySelector("script")).toBeNull();
  expect(screen.getByText("Call with -1.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "JSON" }).getAttribute("href")).toBe(
    "/v1/runs/run_synthetic/exports/report.json",
  );
});

it.each([
  ["UNKNOWN", "FAILED", "Unknown", "REVIEW_INVALID"],
  ["INFRASTRUCTURE_FAILURE", "FAILED", "Error", "EXECUTOR_UNAVAILABLE"],
  ["CANCELLED", "CANCELLED", "Cancelled", undefined],
] as const)("renders %s without a semantic verdict", async (outcome, status, label, code) => {
  vi.spyOn(api, "status").mockResolvedValue({
    runId: "run_test",
    snapshotId: "sha256:abc",
    status,
    outcome,
    createdAt: "2026-10-15T00:00:00Z",
    updatedAt: "2026-10-15T00:00:01Z",
    ...(code
      ? {
          error: {
            code,
            message: "A real service failure.",
            category: "INFRASTRUCTURE",
            retryable: true,
          },
        }
      : {}),
  } as VerificationStatusView);
  vi.spyOn(api, "events").mockResolvedValue({ events: [] });
  const report = vi.spyOn(api, "report");
  render(<RunView runId="run_test" />);
  expect(await screen.findByRole("heading", { name: label })).toBeTruthy();
  expect(screen.getByText("No report issued")).toBeTruthy();
  expect(report).not.toHaveBeenCalled();
});

it("cancels only after confirmation and refreshes the durable status", async () => {
  const status = {
    runId: "run_test",
    snapshotId: "sha256:abc",
    status: "REVIEWING",
    outcome: "RUNNING",
    createdAt: "2026-10-15T00:00:00Z",
    updatedAt: "2026-10-15T00:00:01Z",
  } as VerificationStatusView;
  vi.spyOn(api, "status").mockResolvedValue(status);
  vi.spyOn(api, "events").mockResolvedValue({ events: [] });
  const cancel = vi.spyOn(api, "cancel").mockImplementation(() => {
    vi.mocked(api.status).mockResolvedValue({
      ...status,
      status: "CANCELLED",
      outcome: "CANCELLED",
    });
    return Promise.resolve({ ...status, status: "CANCELLED", outcome: "CANCELLED" });
  });
  render(<RunView runId="run_test" />);
  fireEvent.click(await screen.findByRole("button", { name: "Cancel verification" }));
  expect(cancel).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Stop run" }));
  await waitFor(() => expect(cancel).toHaveBeenCalledWith("run_test"));
  expect(await screen.findByRole("heading", { name: "Cancelled" })).toBeTruthy();
});
