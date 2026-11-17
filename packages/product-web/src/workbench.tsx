import { useEffect, useRef, useState, type SyntheticEvent, type ReactNode } from "react";
import type { Requirement } from "../../advanced-verifier/src/gate.js";
import type { VerificationOutcome } from "../../product-service/src/contracts.js";
import {
  api,
  request,
  isTerminal,
  type VerificationReport,
  type VerificationStatusView,
  type VerificationActivityEvent,
} from "./api.js";
import { useRun } from "./use-run.js";
import { requirementEvidence, summarizeReview, verdictExplanation } from "./report-view.js";
import { History, SourceInspector, Settings } from "./library.js";
import { Research } from "./research.js";
import { staticReplay, applicationBase } from "./edition.js";
import { ReplayAcceptance, ReplayDetails, ReplayUnavailable } from "./replay-view.js";

type IconName =
  | "plus"
  | "arrow"
  | "file"
  | "check"
  | "close"
  | "download"
  | "activity"
  | "link"
  | "shield"
  | "history"
  | "code"
  | "settings"
  | "archive";
function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    history: (
      <>
        <path d="M3 11a9 9 0 1 1 2 7M3 4v7h7" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    code: <path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18" />,
    settings: (
      <>
        <path d="M4 7h16M4 17h16" />
        <circle cx="9" cy="7" r="3" />
        <circle cx="15" cy="17" r="3" />
      </>
    ),
    archive: (
      <>
        <path d="M4 8v13h16V8M3 3h18v5H3zM9 12h6" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    file: (
      <>
        <path d="M14 3H5v18h14V8z" />
        <path d="M14 3v6h5" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    download: <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />,
    activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
    link: (
      <>
        <path d="m10 7 3-3a4 4 0 0 1 6 6l-3 3M14 17l-3 3a4 4 0 0 1-6-6l3-3M8 16l8-8" />
      </>
    ),
    shield: <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export function outcomePresentation(outcome: VerificationOutcome) {
  const values = {
    PENDING: {
      label: "Queued",
      tone: "pending",
      title: "Your candidate is in safe hands.",
      description: "The snapshot is saved. Waiting for the isolated verifier to start.",
    },
    RUNNING: {
      label: "In progress",
      tone: "running",
      title: "Following the requirements.",
      description: "The verifier is gathering evidence against the original specification.",
    },
    COMPLETE: {
      label: "Complete",
      tone: "complete",
      title: "The evidence supports completion.",
      description:
        "The service recorded COMPLETE. Inspect the persisted report for its coverage and check outcomes.",
    },
    INCOMPLETE: {
      label: "Incomplete",
      tone: "incomplete",
      title: "A requirement needs attention.",
      description: "The review found concrete evidence that contradicts an explicit requirement.",
    },
    UNKNOWN: {
      label: "Unknown",
      tone: "unknown",
      title: "The review is inconclusive.",
      description:
        "A reliable calibrated verdict could not be produced. This is not a finding of nonconformance.",
    },
    INFRASTRUCTURE_FAILURE: {
      label: "Error",
      tone: "error",
      title: "Verification could not finish.",
      description:
        "An infrastructure or service error interrupted this run. No semantic verdict was issued.",
    },
    CANCELLED: {
      label: "Cancelled",
      tone: "cancelled",
      title: "This verification was cancelled.",
      description: "The run was stopped. No completion verdict was issued.",
    },
  } as const;
  return values[outcome];
}

export function Intake({
  onCreated,
  create = api.create,
}: {
  onCreated: (runId: string) => void;
  create?: typeof api.create;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [spec, setSpec] = useState("SPEC.md");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const choose = (value: File | undefined): void => {
    if (!value) return;
    setError(null);
    setFile(null);
    if (!value.name.toLowerCase().endsWith(".zip")) {
      setError("Choose a repository ZIP archive.");
      return;
    }
    if (value.size > 10 * 1024 * 1024) {
      setError("The ZIP must be 10 MB or smaller.");
      return;
    }
    setFile(value);
  };
  const submit = async (event: SyntheticEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await create(file, spec.trim());
      onCreated(created.runId);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not create the run.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="intake-layout enter">
      <section className="intake-paper paper" aria-labelledby="intake-heading">
        <div className="paper-topline">
          <span className="eyebrow">New verification</span>
          <Icon name="file" />
        </div>
        <h2 id="intake-heading">Start with the source.</h2>
        <p className="paper-intro">
          A specification. An implementation.
          <br />A clear chain of evidence between them.
        </p>
        <form
          onSubmit={(event) => {
            void submit(event);
          }}
        >
          <div
            className={`dropzone ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              if (!busy) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              if (!busy) choose(event.dataTransfer.files[0]);
            }}
          >
            <input
              ref={input}
              className="sr-only"
              id="repository-zip"
              aria-label="Repository ZIP"
              type="file"
              tabIndex={-1}
              accept=".zip,application/zip"
              disabled={busy}
              onChange={(event) => choose(event.target.files?.[0])}
            />
            <div className="file-symbol">
              <Icon name={file ? "check" : "file"} size={30} />
            </div>
            <strong>{file ? file.name : "Drop your repository ZIP here"}</strong>
            <span>
              {file
                ? `${(file.size / 1024).toFixed(1)} KB · ready to snapshot`
                : "Include source, visible tests and your specification."}
            </span>
            <button
              className="button secondary"
              type="button"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              {file ? "Choose another archive" : "Browse files"}
              <Icon name="plus" size={16} />
            </button>
            <small>ZIP · up to 10 MB · exclude dependencies and secrets</small>
          </div>
          <label className="field-label" htmlFor="spec-path">
            Specification path <span>inside the ZIP</span>
          </label>
          <input
            id="spec-path"
            className="text-input"
            value={spec}
            onChange={(event) => setSpec(event.target.value)}
            placeholder="SPEC.md"
            required
            maxLength={240}
            disabled={busy}
            spellCheck={false}
          />
          <p className="field-hint">
            Relative to the archive root. The original text grounds every requirement.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="button primary start-button"
            disabled={!file || !spec.trim() || busy}
            type="submit"
          >
            {busy ? "Creating snapshot…" : "Start verification"}
            <Icon name="arrow" />
          </button>
        </form>
        <p className="intake-footnote">
          <Icon name="shield" size={16} />
          Candidate code runs in an isolated environment.
        </p>
      </section>
      <aside className="intake-notes" aria-label="How verification works">
        <h2>
          Completion,
          <br />
          <em>examined.</em>
        </h2>
        <p>Review the reasoning behind a verdict, one stated requirement at a time.</p>
        <ol className="method-list">
          <li>
            <span>01</span>
            <div>
              <h3>Capture the contract</h3>
              <p>The specification becomes an atomic requirement ledger.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Follow the evidence</h3>
              <p>Source inspection and targeted checks establish what the code actually does.</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Calibrate the verdict</h3>
              <p>Only a grounded, evidenced contradiction can become a blocking finding.</p>
            </div>
          </li>
        </ol>
        <div className="profile-note">
          <span className="micro-label">Verifier profile</span>
          <strong>A1.1 / Frozen</strong>
          <p>Single reasoning agent · deterministic calibration</p>
        </div>
      </aside>
    </div>
  );
}

function shortId(id: string): string {
  return id.replace("run_", "").slice(0, 12);
}
function time(value: string): string {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
function date(value: string): string {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Activity({ events, active }: { events: VerificationActivityEvent[]; active: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState(active);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 761px)");
    const adapt = (): void => setOpen(active || query.matches);
    adapt();
    query.addEventListener("change", adapt);
    return () => query.removeEventListener("change", adapt);
  }, [active]);
  const displayed = expanded ? events : events.slice(-3);
  return (
    <details
      className="activity-section"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="section-line">
        <h3 id="activity-title" className="eyebrow">
          Activity ledger
        </h3>
        <span className="mono">{String(events.length).padStart(2, "0")}</span>
      </summary>
      {events.length === 0 ? (
        <p className="muted small">Waiting for persisted activity from the service.</p>
      ) : (
        <ol className="activity-list">
          {displayed.map((event) => (
            <li key={event.sequence}>
              <span className="event-dot" />
              <div>
                <div className="event-meta">
                  <time dateTime={event.occurredAt}>{time(event.occurredAt)}</time>
                  <span>{event.source}</span>
                </div>
                <p>{event.message}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {events.length > 3 && (
        <button className="text-button" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Show recent activity" : `View all ${String(events.length)} events`}
          <Icon name="arrow" size={14} />
        </button>
      )}
    </details>
  );
}

function TechnicalText({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/(\b[A-Za-z_$][\w$]*\([^)]*\)|\b(?:[\w.-]+\/)+[\w.-]+)/gu)
        .map((part, index) => (index % 2 ? <code key={index}>{part}</code> : part))}
    </>
  );
}

function Observation({ text }: { text: string }) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const value: unknown = JSON.parse(text.slice(start, end + 1));
      return (
        <>
          <p className="observed">
            {text
              .slice(0, start)
              .replace(/['"`]\s*$/u, "")
              .trimEnd()}
          </p>
          <pre className="observed-output" tabIndex={0} aria-label="Recorded JSON output">
            {JSON.stringify(value, null, 2)}
          </pre>
          {text.slice(end + 1).replace(/[\s'"`.]/gu, "") && (
            <p className="observed">{text.slice(end + 1).replace(/^[\s'"`]*\.?\s*/u, "")}</p>
          )}
        </>
      );
    } catch {
      /* Preserve the original observation when it is not literal JSON. */
    }
  }
  return <p className="observed">{text}</p>;
}

export function EvidenceReport({
  report,
  initialRequirement,
  onInspect,
  exports: reportExports,
  onRequirementChange,
}: {
  report: VerificationReport;
  initialRequirement?: string | undefined;
  onInspect?: ((requirementId: string) => void) | undefined;
  exports?: { json: string; md: string } | undefined;
  onRequirementChange?: ((id: string) => void) | undefined;
}) {
  const [selectedId, setSelectedId] = useState(
    initialRequirement ?? report.review.requirements[0]?.id ?? "",
  );
  const [indexOpen, setIndexOpen] = useState(false);
  const detail = useRef<HTMLElement>(null);
  const requirement =
    report.review.requirements.find((item) => item.id === selectedId) ??
    report.review.requirements[0];
  if (!requirement)
    return <div className="paper empty-paper">No requirement ledger was returned.</div>;
  const coverage = requirementEvidence(report.review, requirement.id);
  const evidence = coverage.records;
  const summary = summarizeReview(report.review);
  const inconclusive = report.review.evidence.filter((item) => item.disposition === "INCONCLUSIVE");
  const obligations = report.review.proofObligations.filter(
    (item) => item.requirementId === requirement.id,
  );
  const blockers = report.review.blockingFindings.filter(
    (item) => item.requirementId === requirement.id,
  );
  const advisories = report.review.advisories.filter(
    (item) => item.requirementId === requirement.id,
  );
  const generalAdvisories = report.review.advisories.filter(
    (item) => !report.review.requirements.some((entry) => entry.id === item.requirementId),
  );
  const select = (item: Requirement, keyboard = false): void => {
    setSelectedId(item.id);
    onRequirementChange?.(item.id);
    setIndexOpen(false);
    if (window.matchMedia("(max-width: 760px)").matches)
      requestAnimationFrame(() => {
        detail.current?.focus({ preventScroll: true });
        detail.current?.scrollIntoView({
          behavior:
            keyboard || window.matchMedia("(prefers-reduced-motion: reduce)").matches
              ? "instant"
              : "smooth",
          block: "start",
        });
      });
  };
  const inspectEvidence = (id: string): void => {
    const record = report.review.evidence.find((item) => item.id === id);
    if (!record) return;
    if (!record.requirementIds.includes(requirement.id)) {
      const linked = report.review.requirements.find((item) =>
        record.requirementIds.includes(item.id),
      );
      if (linked) {
        setSelectedId(linked.id);
        setIndexOpen(false);
      }
    }
    requestAnimationFrame(() => {
      const target = document.getElementById(`evidence-${id}`);
      const reproduction = target?.querySelector("details");
      if (reproduction) reproduction.open = true;
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  };
  return (
    <section className="paper evidence-paper" aria-label="Evidence report">
      <header className="dossier-header">
        <div>
          <h2>Evidence dossier</h2>
          <p>
            <strong>
              {summary.covered}/{summary.required}
            </strong>{" "}
            required items covered <span>/</span> {summary.evidence} evidence records <span>/</span>{" "}
            {summary.blockers} blockers
          </p>
        </div>
        <span className="dossier-seal">
          <Icon name="shield" size={22} />
        </span>
      </header>
      {inconclusive.length > 0 && (
        <div className="inconclusive-notice">
          <div>
            <strong>
              {inconclusive.length} inconclusive {inconclusive.length === 1 ? "check" : "checks"}
            </strong>
            <p>These records do not establish decisive coverage.</p>
          </div>
          <div>
            {inconclusive.map((item) => (
              <button
                key={item.id}
                onClick={() => inspectEvidence(item.id)}
                aria-label={`Inspect inconclusive evidence ${item.id}`}
              >
                {item.id}
                <Icon name="arrow" size={14} />
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="dossier-body">
        <nav className="requirement-index" aria-label="Requirements">
          <div className="index-toolbar">
            <span className="micro-label">Requirement index</span>
            <span>{report.review.requirements.length} items</span>
          </div>
          <button
            className="index-toggle"
            aria-expanded={indexOpen}
            aria-controls="requirement-list"
            onClick={() => setIndexOpen(!indexOpen)}
          >
            Choose requirement <strong>{requirement.id}</strong>
            <Icon name="plus" size={16} />
          </button>
          <div
            className={`requirement-list ${indexOpen ? "is-open" : ""}`}
            id="requirement-list"
            onKeyDown={(event) => {
              if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
              const buttons = Array.from(
                event.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
              );
              const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
              if (current < 0) return;
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? buttons.length - 1
                    : (current + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) %
                      buttons.length;
              const item = report.review.requirements[next];
              if (item) {
                setSelectedId(item.id);
                onRequirementChange?.(item.id);
                buttons[next]?.focus();
              }
            }}
          >
            {report.review.requirements.map((item) => {
              const blocked = report.review.blockingFindings.some(
                (finding) => finding.requirementId === item.id,
              );
              const itemCoverage = requirementEvidence(report.review, item.id);
              return (
                <button
                  key={item.id}
                  aria-label={`${item.id}: ${item.statement}`}
                  aria-current={item.id === requirement.id ? "true" : undefined}
                  aria-controls="requirement-detail"
                  onClick={(event) => select(item, event.detail === 0)}
                >
                  <span className="index-entry-top">
                    <span className="requirement-id">{item.id}</span>
                    <span>
                      {item.classification === "ADVISORY"
                        ? "Advisory"
                        : blocked
                          ? "Blocking finding"
                          : itemCoverage.covered
                            ? "Covered"
                            : "Coverage unresolved"}
                    </span>
                    {item.id === requirement.id && <span className="selected-label">Selected</span>}
                  </span>
                  <span className="index-statement">
                    <TechnicalText text={item.statement} />
                  </span>
                  <span className="index-counts">
                    {itemCoverage.supporting} supporting
                    {itemCoverage.contradicting > 0 && (
                      <> · {itemCoverage.contradicting} contradicting</>
                    )}
                    {itemCoverage.inconclusive > 0 && (
                      <span> · {itemCoverage.inconclusive} inconclusive</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="index-help">
            Coverage records a decisive evidence link. It does not mean every check passed.
          </p>
        </nav>
        <article
          id="requirement-detail"
          className="requirement-detail"
          ref={detail}
          tabIndex={-1}
          aria-labelledby="requirement-heading"
        >
          <div className="detail-kicker">
            <span className="eyebrow">Requirement {requirement.id}</span>
            <span
              className={
                blockers.length || coverage.contradicting
                  ? "text-danger"
                  : coverage.covered || requirement.classification === "ADVISORY"
                    ? "text-sage"
                    : "text-uncertain"
              }
            >
              {blockers.length
                ? "Contradiction found"
                : requirement.classification === "ADVISORY"
                  ? "Advisory"
                  : coverage.contradicting
                    ? "Contradictory evidence"
                    : coverage.covered
                      ? "Recorded coverage"
                      : "Coverage unresolved"}
            </span>
          </div>
          <h2 id="requirement-heading" tabIndex={-1}>
            <TechnicalText text={requirement.statement} />
          </h2>
          {onInspect && (
            <button className="text-button source-entry" onClick={() => onInspect(requirement.id)}>
              <Icon name="code" size={16} />
              Inspect snapshot with {requirement.id} evidence
            </button>
          )}
          <nav className="trace-nav" aria-label="Requirement evidence trail">
            <a href="#requirement-heading">01 Requirement</a>
            <a href={`#proof-${requirement.id}`}>
              02 Proof <span>{obligations.length}</span>
            </a>
            <a href={`#records-${requirement.id}`}>
              03 Evidence <span>{evidence.length}</span>
            </a>
          </nav>
          <div className="success-condition">
            <span className="micro-label">Observable success condition</span>
            <p>{requirement.observableSuccessCondition}</p>
          </div>
          <section
            className="proof-section"
            id={`proof-${requirement.id}`}
            tabIndex={-1}
            aria-label={`Proof for ${requirement.id}`}
          >
            <div className="trace-section-heading">
              <h3>Proof obligations</h3>
              <span>Recorded review plan</span>
            </div>
            {obligations.length === 0 && (
              <p className="proof-empty">No proof obligation is recorded for this item.</p>
            )}
            {obligations.map((obligation, index) => (
              <details
                className="obligation"
                key={`${obligation.requirementId}-${String(index)}`}
                open
              >
                <summary>
                  {obligations.length > 1
                    ? `Obligation ${String(index + 1)}`
                    : "Recorded proposition"}{" "}
                  <Icon name="plus" size={15} />
                </summary>
                <p>{obligation.proposition}</p>
                <span className="micro-label">Evidence plan</span>
                <p>{obligation.evidencePlan}</p>
              </details>
            ))}
            <div className="proof-evidence-links">
              <span>Follow {requirement.id} to its evidence</span>
              <div>
                {evidence.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => inspectEvidence(item.id)}
                    aria-label={`Inspect evidence ${item.id}`}
                  >
                    <strong>{item.id}</strong>
                    <span>
                      {item.disposition === "SUPPORTS"
                        ? "Supports"
                        : item.disposition === "CONTRADICTS"
                          ? "Contradicts"
                          : "Inconclusive"}
                    </span>
                    <Icon name="arrow" size={14} />
                  </button>
                ))}
              </div>
              <small>
                Links are recorded at requirement level; proof steps are not individually graded.
              </small>
            </div>
          </section>
          {blockers.map((finding) => (
            <section className="finding" key={finding.id}>
              <span className="micro-label">Calibrated blocker / {finding.id}</span>
              <h3>{finding.claim}</h3>
              <dl>
                <dt>Expected</dt>
                <dd>{finding.expectedBehavior}</dd>
                <dt>Observed</dt>
                <dd>{finding.observedBehavior}</dd>
              </dl>
              <p className="calibration-note">{finding.calibrationReason}</p>
              <div className="finding-evidence-links">
                {finding.evidenceIds
                  .filter((id) => evidence.some((item) => item.id === id))
                  .map((id) => (
                    <button className="text-button" key={id} onClick={() => inspectEvidence(id)}>
                      Inspect {id}
                      <Icon name="arrow" size={14} />
                    </button>
                  ))}
              </div>
              <span className="micro-label">Reproduction</span>
              <pre>{finding.reproduction}</pre>
            </section>
          ))}
          <section
            className="evidence-records"
            id={`records-${requirement.id}`}
            tabIndex={-1}
            aria-label={`Evidence for ${requirement.id}`}
          >
            <div className="trace-section-heading">
              <h3>Collected evidence</h3>
              <span>
                {coverage.supporting} supporting · {coverage.contradicting} contradicting ·{" "}
                {coverage.inconclusive} inconclusive
              </span>
            </div>
            {evidence.length === 0 && (
              <p className="proof-empty">No linked evidence is recorded.</p>
            )}
            {evidence.map((item) => (
              <section
                className={`evidence-record ${item.disposition.toLowerCase()}`}
                key={item.id}
                id={`evidence-${item.id}`}
                tabIndex={-1}
                aria-label={`Evidence ${item.id}`}
              >
                <div className="section-line">
                  <span className="micro-label">
                    {item.id} / {item.evidenceType.replaceAll("_", " ").toLowerCase()}
                  </span>
                  <span className={`evidence-disposition ${item.disposition.toLowerCase()}`}>
                    {item.disposition === "SUPPORTS"
                      ? "Supports"
                      : item.disposition === "CONTRADICTS"
                        ? "Contradicts"
                        : "Inconclusive"}
                  </span>
                </div>
                {item.disposition === "INCONCLUSIVE" && (
                  <p className="inconclusive-explanation">
                    This check did not establish support or contradiction. It is excluded from
                    decisive coverage.
                  </p>
                )}
                <Observation text={item.observedBehavior} />
                <details>
                  <summary>
                    Inspect reproduction <Icon name="plus" size={15} />
                  </summary>
                  <pre>{item.reproduction}</pre>
                </details>
              </section>
            ))}
          </section>
          {advisories.map((item) => (
            <details className="advisory" key={item.id}>
              <summary>
                Advisory / {item.claim}
                <Icon name="plus" size={15} />
              </summary>
              <p>{item.calibrationReason}</p>
              <p>{item.observedBehavior}</p>
            </details>
          ))}
          <footer className="detail-footer">
            <span className="micro-label">Grounded in the original specification</span>
            <Icon name="link" size={16} />
          </footer>
        </article>
      </div>
      {generalAdvisories.length > 0 && (
        <div className="general-advisories">
          <h3>General advisories</h3>
          {generalAdvisories.map((item) => (
            <details className="advisory" key={item.id}>
              <summary>
                {item.claim}
                <Icon name="plus" size={15} />
              </summary>
              <p>{item.calibrationReason}</p>
              <p>{item.observedBehavior}</p>
            </details>
          ))}
        </div>
      )}
      <footer className="dossier-footer">
        <span>
          {reportExports ? "REPLAY · saved acceptance report" : "Persisted report · A1.1"}
        </span>
        <div>
          <a
            className="button paper-button"
            href={reportExports?.json ?? api.exportUrl(report.runId, "json")}
            download
          >
            <Icon name="download" size={15} />
            JSON
          </a>
          <a
            className="button paper-button"
            href={reportExports?.md ?? api.exportUrl(report.runId, "md")}
            download
          >
            <Icon name="download" size={15} />
            Markdown
          </a>
        </div>
      </footer>
    </section>
  );
}

function WaitingDossier({ status }: { status: VerificationStatusView }) {
  const state = outcomePresentation(status.outcome);
  const active = !isTerminal(status);
  return (
    <section className="paper waiting-dossier" aria-labelledby="waiting-title">
      <div className="paper-topline">
        <span className="eyebrow">Evidence dossier</span>
        <span>{active ? "Awaiting report" : "No report issued"}</span>
      </div>
      <div className="waiting-content">
        <span className={`large-symbol ${state.tone}`}>
          <Icon
            name={active ? "activity" : status.outcome === "CANCELLED" ? "close" : "file"}
            size={38}
          />
        </span>
        <h2 id="waiting-title">{active ? "Evidence takes a little work." : state.title}</h2>
        <p>{state.description}</p>
        {status.error && (
          <div className="error-detail">
            <code>{status.error.code}</code>
            <p>{status.error.message}</p>
          </div>
        )}
        <p className="waiting-note">
          {active
            ? "This panel will update when the calibrated report is persisted. Follow the real activity in the ledger."
            : "The candidate snapshot and activity remain saved. Start a new verification to try again."}
        </p>
      </div>
      <div className="paper-bottom-note">Requirement grounding → Evidence → Calibration</div>
    </section>
  );
}

export function RunView({
  runId,
  initialRequirement,
  onInspect,
}: {
  runId: string;
  initialRequirement?: string | undefined;
  onInspect?: ((requirementId: string) => void) | undefined;
}) {
  const run = useRun(runId);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const cancel = async (): Promise<void> => {
    setCancelBusy(true);
    setCancelError(null);
    try {
      await api.cancel(runId);
      setConfirmCancel(false);
      run.refresh();
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : "Cancellation failed.");
    } finally {
      setCancelBusy(false);
    }
  };
  if (!run.status)
    return (
      <div className="connection-panel" role={run.error ? "alert" : "status"}>
        <Icon name="link" size={28} />
        <h2>{run.error ? "Could not open this run." : "Opening the verification…"}</h2>
        <p>{run.error ?? "Reading the persisted record from your local service."}</p>
        {run.error && (
          <button className="button secondary" onClick={run.refresh}>
            Try again
          </button>
        )}
      </div>
    );
  const status = run.status;
  const presentation = outcomePresentation(status.outcome);
  const active = !isTerminal(status);
  return (
    <div className="run-layout enter">
      <aside className="operations" aria-label="Verification run">
        <div className="section-line">
          <span className="eyebrow">Verification run</span>
          <span className="mono run-number">{shortId(runId).slice(0, 6)}</span>
        </div>
        <div className={`run-status ${presentation.tone}`}>
          <span className="run-status-icon">
            <Icon
              name={
                status.outcome === "COMPLETE"
                  ? "check"
                  : active
                    ? "activity"
                    : status.outcome === "CANCELLED"
                      ? "close"
                      : "file"
              }
              size={24}
            />
          </span>
          <h2>{presentation.label}</h2>
        </div>
        <p className="run-description">
          {run.report ? verdictExplanation(run.report.review) : presentation.description}
        </p>
        <dl className="run-metadata">
          <div>
            <dt>Candidate snapshot</dt>
            <dd>
              <code title={status.snapshotId}>{status.snapshotId.slice(0, 23)}…</code>
              <span className="small muted">Immutable · SHA-256</span>
            </dd>
          </div>
          <div>
            <dt>Started</dt>
            <dd>
              <time dateTime={status.createdAt}>{date(status.createdAt)}</time>
            </dd>
          </div>
          <div>
            <dt>Verifier</dt>
            <dd>
              A1.1 <span className="muted">/ Frozen profile</span>
            </dd>
          </div>
        </dl>
        <div className="run-stage">
          <span className="micro-label">Service state</span>
          <span>{status.status.toLowerCase()}</span>
        </div>
        {run.error && (
          <div className="connection-warning" role="alert">
            <p>Updates paused: {run.error}</p>
            <button className="text-button" onClick={run.refresh}>
              Reconnect
            </button>
          </div>
        )}
        <Activity events={run.events} active={active} />
        {active && (
          <div className="cancel-area">
            {confirmCancel ? (
              <>
                <p>Stop this verification? No verdict will be issued.</p>
                <div className="button-row">
                  <button
                    className="button danger"
                    disabled={cancelBusy}
                    onClick={() => {
                      void cancel();
                    }}
                  >
                    {cancelBusy ? "Stopping…" : "Stop run"}
                  </button>
                  <button
                    className="button secondary"
                    disabled={cancelBusy}
                    onClick={() => setConfirmCancel(false)}
                  >
                    Keep running
                  </button>
                </div>
              </>
            ) : (
              <button className="text-button" onClick={() => setConfirmCancel(true)}>
                <Icon name="close" size={14} />
                Cancel verification
              </button>
            )}
            {cancelError && <p role="alert">{cancelError}</p>}
          </div>
        )}
        <p className="sync-note">
          {active && !run.error ? "Polling live activity" : "Persisted local record"}
          {run.refreshedAt && <> · {time(run.refreshedAt)}</>}
        </p>
      </aside>
      {run.report ? (
        <EvidenceReport
          report={run.report}
          initialRequirement={initialRequirement}
          onInspect={onInspect}
        />
      ) : (
        <WaitingDossier status={status} />
      )}
      <span className="sr-only" role="status" aria-live="polite">
        Verification {presentation.label}.{" "}
        {status.status === "CALIBRATING" ? "Calibrating evidence." : ""}
      </span>
    </div>
  );
}

function readRunId(): string | null {
  if (staticReplay) return null;
  const value = new URLSearchParams(window.location.search).get("run");
  return value && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value) ? value : null;
}

type Page = "verification" | "history" | "source" | "settings" | "research" | "report";
function readPage(): Page {
  const value = new URLSearchParams(window.location.search).get("view");
  if (staticReplay && value === "report") return "report";
  return value === "history" || value === "source" || value === "settings" || value === "research"
    ? value
    : value === "verification" || readRunId()
      ? "verification"
      : "research";
}
const pageTitles: Record<
  Exclude<Page, "verification">,
  { title: string; description: string; label: string }
> = {
  report: {
    title: "The verdict. The evidence.",
    description: "A genuine saved acceptance report. Trace each requirement to its recorded proof.",
    label: "Acceptance report",
  },
  history: {
    title: "A record of the work.",
    description: "Reopen the evidence. Compare the record. Keep the provenance.",
    label: "Run history",
  },
  source: {
    title: "The source, preserved.",
    description: "Inspect the exact candidate behind the verdict, without changing a byte.",
    label: "Source snapshots",
  },
  settings: {
    title: "Local by design.",
    description: "Effective configuration, frozen identity, and a real isolation preflight.",
    label: "Service settings",
  },
  research: {
    title: "The research record.",
    description: "A transparent account of what we measured—and what we did not improve.",
    label: "Research archive",
  },
};

function focusMain(): void {
  requestAnimationFrame(() => document.getElementById("main")?.focus({ preventScroll: true }));
}

export function App() {
  const [liveEnabled, setLiveEnabled] = useState<boolean | null>(null);
  const [modeUnavailable, setModeUnavailable] = useState(false);
  useEffect(() => {
    if (staticReplay) {
      setLiveEnabled(false);
      return;
    }
    const controller = new AbortController();
    void request<{ liveVerificationEnabled: unknown }>("/v1/settings", {
      signal: controller.signal,
    })
      .then((settings) => setLiveEnabled(settings.liveVerificationEnabled === true))
      .catch(() => {
        if (!controller.signal.aborted) {
          setModeUnavailable(true);
          setLiveEnabled(false);
        }
      });
    return () => controller.abort();
  }, []);
  const [runId, setRunId] = useState(readRunId);
  const [page, setPage] = useState<Page>(readPage);
  const [requirement, setRequirement] = useState(() =>
    new URLSearchParams(window.location.search).get("requirement"),
  );
  const [lastRunId, setLastRunId] = useState<string | null>(() => {
    if (staticReplay) return null;
    try {
      return localStorage.getItem("intentbench:last-run");
    } catch {
      return null;
    }
  });
  const [copyLabel, setCopyLabel] = useState("Copy run link");
  useEffect(() => {
    const onPop = (): void => {
      setRunId(readRunId());
      setPage(readPage());
      setRequirement(new URLSearchParams(window.location.search).get("requirement"));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const navigate = (id: string | null, requirementId?: string): void => {
    const url = new URL(window.location.href);
    url.searchParams.delete("view");
    if (!id) url.searchParams.set("view", "verification");
    url.searchParams.delete("requirement");
    if (requirementId) url.searchParams.set("requirement", requirementId);
    if (id) {
      url.searchParams.set("run", id);
      setLastRunId(id);
      try {
        localStorage.setItem("intentbench:last-run", id);
      } catch {
        /* Browser storage is optional. */
      }
    } else url.searchParams.delete("run");
    window.history.pushState({}, "", url);
    setRunId(id);
    setPage("verification");
    setRequirement(requirementId ?? null);
    window.scrollTo({ top: 0 });
    focusMain();
  };
  const navigatePage = (
    next: Exclude<Page, "verification">,
    id?: string | null,
    requirementId?: string,
  ): void => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", next);
    url.searchParams.delete("requirement");
    if (next === "source" && (id ?? runId ?? lastRunId))
      url.searchParams.set("run", id ?? runId ?? lastRunId ?? "");
    else url.searchParams.delete("run");
    if (requirementId) url.searchParams.set("requirement", requirementId);
    window.history.pushState({}, "", url);
    setRunId(readRunId());
    setPage(next);
    setRequirement(requirementId ?? null);
    window.scrollTo({ top: 0 });
    focusMain();
  };
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyLabel("Link copied");
    } catch {
      setCopyLabel("Copy the URL from your address bar");
    }
  };
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <a
          href={applicationBase}
          className="brand"
          onClick={(event) => {
            event.preventDefault();
            navigate(null);
          }}
          aria-label="IntentBench home"
        >
          <svg viewBox="0 0 32 32" width="30" height="30" fill="none" aria-hidden="true">
            <path d="M24 5H5v23h22V16M10 16l7 7L30 6" stroke="currentColor" strokeWidth="1.6" />
          </svg>
          <span>
            IntentBench<span className="brand-period">.</span>
          </span>
        </a>
        <span className="sidebar-caption micro-label">Workspace</span>
        <nav aria-label="Main navigation">
          <button
            className={page === "verification" && !runId ? "active" : ""}
            aria-current={page === "verification" && !runId ? "page" : undefined}
            onClick={() => navigate(null)}
          >
            <Icon name="plus" size={18} />
            New verification
          </button>
          {(runId ?? lastRunId) && (
            <button
              className={page === "verification" && runId ? "active" : ""}
              aria-current={page === "verification" && runId ? "page" : undefined}
              onClick={() => navigate(runId ?? lastRunId)}
            >
              <Icon name="file" size={18} />
              {page === "verification" && runId ? "Current verification" : "Last verification"}
            </button>
          )}
          {(staticReplay
            ? ([
                ["research", "archive"],
                ["report", "file"],
                ["source", "code"],
                ["settings", "settings"],
              ] as const)
            : ([
                ["history", "history"],
                ["source", "code"],
                ["research", "archive"],
                ["settings", "settings"],
              ] as const)
          ).map(([target, icon]) => (
            <button
              key={target}
              className={page === target ? "active" : ""}
              aria-current={page === target ? "page" : undefined}
              onClick={() => navigatePage(target)}
            >
              <Icon name={icon} size={18} />
              {staticReplay && target === "settings"
                ? "Demo details"
                : staticReplay && target === "source"
                  ? "Source availability"
                  : pageTitles[target].label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Icon name="shield" size={20} />
          <p>
            Grounded in intent.
            <br />
            <span>Backed by evidence.</span>
          </p>
          <span className="micro-label">
            {staticReplay ? "Public replay / read-only" : "Local edition / 0.3"}
          </span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            {staticReplay ? "Recorded evidence" : "Local workspace"} <span>/</span>
            <strong>
              {page !== "verification"
                ? pageTitles[page].label
                : runId
                  ? shortId(runId)
                  : "New verification"}
            </strong>
          </div>
          <span className="local-indicator">
            <span />
            {staticReplay ? "Static REPLAY" : "Local service"}
          </span>
        </header>
        <main id="main" className="main-content" tabIndex={-1}>
          <p className="muted small" role="status">
            {modeUnavailable
              ? "Execution mode unavailable; uploads remain disabled."
              : staticReplay
                ? "PUBLIC REPLAY — authentic recorded evidence. No live verification or uploads."
                : liveEnabled === true
                  ? "Live mode enabled. New verification requires the pinned isolated runtime and dedicated authentication."
                  : liveEnabled === false
                    ? "Recorded-only edition — research is REPLAY; no model execution is enabled."
                    : "Checking execution mode; uploads remain disabled."}
          </p>
          <header className="page-heading">
            <div>
              <h1>
                {page !== "verification"
                  ? staticReplay && page === "settings"
                    ? "Static by design."
                    : staticReplay && page === "source"
                      ? "Source availability."
                      : pageTitles[page].title
                  : runId
                    ? "The verdict. The evidence."
                    : "A verdict you can inspect."}
              </h1>
              <p>
                {page !== "verification"
                  ? staticReplay && page === "settings"
                    ? "Public evidence. No execution backend. No credentials."
                    : staticReplay && page === "source"
                      ? "The report is public; its original candidate snapshot is not."
                      : pageTitles[page].description
                  : runId
                    ? "Trace the conclusion back to the original requirement."
                    : "Examine the distance between what was asked and what was built."}
              </p>
            </div>
            {page === "verification" && runId && (
              <div className="heading-actions">
                <button
                  className="icon-button"
                  onClick={() => {
                    void copy();
                  }}
                  aria-label={copyLabel}
                  title={copyLabel}
                >
                  <Icon name="link" />
                </button>
                <button className="button secondary" onClick={() => navigate(null)}>
                  <Icon name="plus" size={16} />
                  New verification
                </button>
                <span className="sr-only" role="status">
                  {copyLabel === "Copy run link" ? "" : copyLabel}
                </span>
              </div>
            )}
          </header>
          {staticReplay && page === "report" ? (
            <ReplayAcceptance>
              {({ report, downloads }) => (
                <EvidenceReport
                  key={requirement}
                  report={report}
                  initialRequirement={requirement ?? undefined}
                  exports={downloads}
                  onRequirementChange={(id) => {
                    const url = new URL(window.location.href);
                    url.searchParams.set("requirement", id);
                    window.history.replaceState({}, "", url);
                  }}
                />
              )}
            </ReplayAcceptance>
          ) : staticReplay && (page === "history" || page === "source") ? (
            <ReplayUnavailable source={page === "source"} />
          ) : staticReplay && page === "settings" ? (
            <ReplayDetails />
          ) : page === "history" ? (
            <History onOpen={navigate} />
          ) : page === "source" ? (
            <SourceInspector
              runId={runId}
              requirementId={requirement}
              onOpen={navigate}
              onSelectRun={(id) => navigatePage("source", id)}
            />
          ) : page === "settings" ? (
            <Settings />
          ) : page === "research" ? (
            <Research />
          ) : runId ? (
            <RunView
              key={`${runId}:${requirement ?? ""}`}
              runId={runId}
              initialRequirement={requirement ?? undefined}
              onInspect={(id) => navigatePage("source", runId, id)}
            />
          ) : liveEnabled === true ? (
            <Intake onCreated={navigate} />
          ) : (
            <section className="intake-card">
              <h2>Live verification is disabled.</h2>
              <p>
                {staticReplay ? (
                  "This static demo has no upload receiver or execution backend. Explore the saved acceptance report or research archive. To verify your own code, use the separate local application."
                ) : (
                  <>
                    Browse authentic recorded research without Docker or authentication. Live
                    execution requires explicit service opt-in, a validated pinned Docker image and
                    dedicated credentials. No host execution fallback exists.
                  </>
                )}
              </p>
              <button className="button secondary" onClick={() => navigatePage("research")}>
                Browse recorded research
              </button>
            </section>
          )}
          <footer className="workspace-footer">
            <span>IntentBench / evidence before assertion</span>
            <span>
              {staticReplay ? "Recorded evidence" : "Local API"}{" "}
              <span className="footer-rule">—</span> A1.1
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
