import { useEffect, useState, type ReactNode } from "react";
import type { CandidateSnapshotManifest } from "../../product-core/src/schemas.js";
import type { RunHistory } from "../../product-service/src/product-library.js";
import { request, api, type VerificationReport, type VerificationStatusView } from "./api.js";
import { summarizeReview } from "./report-view.js";

export function useResource<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<{ key: string; data?: T; error?: string }>({ key });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ key });
    void load(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ key, data });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            key,
            error:
              error instanceof Error ? error.message : "The local service could not be reached.",
          });
      });
    return () => controller.abort();
    // The stable resource key owns the loader; abort prevents stale responses on navigation.
  }, [key, revision]);
  return {
    ...(state.key === key ? state : { key }),
    retry: () => setRevision((value) => value + 1),
  };
}
export function ResourceState({
  error,
  retry,
  children,
}: {
  error?: string | undefined;
  retry: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="paper library-empty" role={error ? "alert" : "status"}>
      <h2>{error ? "The record is out of reach." : "Reading the local record…"}</h2>
      <p>{error ?? children ?? "Loading persisted data. Nothing is being simulated."}</p>
      {error && (
        <button className="button paper-button" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}
export function elapsed(ms: number) {
  return ms < 60_000 ? `${(ms / 1000).toFixed(1)}s` : `${(ms / 60_000).toFixed(1)} min`;
}
export function date(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}
function label(value: string) {
  return value === "INFRASTRUCTURE_FAILURE" ? "ERROR" : value;
}

export function History({ onOpen }: { onOpen: (id: string) => void }) {
  const history = useResource("history", (signal) => request<RunHistory>("/v1/runs", { signal }));
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [selected, setSelected] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  if (!history.data) return <ResourceState error={history.error} retry={history.retry} />;
  const runs = history.data.runs.filter(
    (run) =>
      (filter === "ALL" || run.outcome === filter) &&
      `${run.runId} ${run.snapshotId} ${run.outcome}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section className="library-page" aria-label="Run history">
      <div className="library-toolbar">
        <label className="search-field">
          Search runs
          <input
            type="search"
            placeholder="Run ID, snapshot hash, or outcome"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          Outcome
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            {[
              "ALL",
              "COMPLETE",
              "INCOMPLETE",
              "UNKNOWN",
              "INFRASTRUCTURE_FAILURE",
              "CANCELLED",
              "PENDING",
              "RUNNING",
            ].map((value) => (
              <option key={value} value={value}>
                {value === "ALL" ? "All outcomes" : label(value)}
              </option>
            ))}
          </select>
        </label>
        <button className="button secondary" onClick={history.retry}>
          Refresh history
        </button>
      </div>
      {history.data.warnings.map((warning) => (
        <p role="alert" key={warning}>
          {warning}
        </p>
      ))}
      <div className="paper record-book">
        <header className="book-heading">
          <div>
            <h2>Verification ledger</h2>
            <p>
              {runs.length} shown / {history.data.runs.length} persisted runs · newest first
            </p>
          </div>
          <button
            className="button paper-button"
            disabled={selected.length !== 2}
            onClick={() => setComparing(true)}
          >
            Compare {selected.length}/2
          </button>
        </header>
        <p className="book-note">
          Compare two saved reports. Outcomes are evidence-backed judgments, not guarantees of
          correctness.
        </p>
        {runs.length === 0 ? (
          <div className="library-empty">
            <h3>
              {history.data.runs.length ? "No runs match these filters." : "No verifications yet."}
            </h3>
            <p>
              {history.data.runs.length
                ? "Try a different search or outcome."
                : "Submit a repository from New verification. Its durable record will appear here."}
            </p>
          </div>
        ) : (
          <div className="record-list">
            {runs.map((run) => (
              <div className="history-row" key={run.runId}>
                <input
                  type="checkbox"
                  aria-label={`Compare ${run.runId}`}
                  checked={selected.includes(run.runId)}
                  disabled={!selected.includes(run.runId) && selected.length === 2}
                  onChange={(event) => {
                    setComparing(false);
                    setSelected(
                      event.target.checked
                        ? [...selected, run.runId]
                        : selected.filter((id) => id !== run.runId),
                    );
                  }}
                />
                <button
                  className="record-open"
                  aria-label={`Open ${run.runId}`}
                  onClick={() => onOpen(run.runId)}
                >
                  <strong>{run.runId}</strong>
                  <span>Snapshot {run.snapshotId.slice(7, 23)}…</span>
                </button>
                <span className={`outcome-tag ${run.outcome.toLowerCase()}`}>
                  {label(run.outcome)}
                </span>
                <time dateTime={run.createdAt}>{date(run.createdAt)}</time>
                <span className="row-duration">
                  {elapsed(Date.parse(run.updatedAt) - Date.parse(run.createdAt))}
                  <small>elapsed record time</small>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      {comparing && selected.length === 2 && (
        <Comparison
          key={selected.join(":")}
          ids={selected}
          onOpen={onOpen}
          onClose={() => setComparing(false)}
        />
      )}
    </section>
  );
}

function Comparison({
  ids,
  onOpen,
  onClose,
}: {
  ids: string[];
  onOpen: (id: string) => void;
  onClose: () => void;
}) {
  const resource = useResource(ids.join(":"), async (signal) =>
    Promise.all(
      ids.map(async (id) => {
        const status = await api.status(id, signal);
        const report = status.status === "SUCCEEDED" ? await api.report(id, signal) : null;
        return { status, report };
      }),
    ),
  );
  if (!resource.data) return <ResourceState error={resource.error} retry={resource.retry} />;
  const [left, right] = resource.data;
  const a =
    left?.report?.review.requirements.filter((item) => item.classification === "REQUIRED") ?? [];
  const b =
    right?.report?.review.requirements.filter((item) => item.classification === "REQUIRED") ?? [];
  const shared = a.filter((item) => b.some((other) => item.statement === other.statement));
  return (
    <section className="paper comparison" aria-label="Run comparison">
      <header className="book-heading">
        <div>
          <h2>Two records, side by side</h2>
          <p>
            {left?.status.snapshotId === right?.status.snapshotId
              ? "Identical candidate snapshot"
              : "Different candidate snapshots"}{" "}
            · no causal or correctness claim
          </p>
        </div>
        <button className="text-button" onClick={onClose}>
          Close comparison
        </button>
      </header>
      <div className="comparison-columns">
        {resource.data.map(({ status, report }) => (
          <article key={status.runId}>
            <button className="text-button" onClick={() => onOpen(status.runId)}>
              {status.runId}
            </button>
            <h3>{label(status.outcome)}</h3>
            <dl>
              <dt>Snapshot</dt>
              <dd className="hash-value">{status.snapshotId}</dd>
              <dt>Recorded elapsed time</dt>
              <dd>{elapsed(Date.parse(status.updatedAt) - Date.parse(status.createdAt))}</dd>
              <dt>Decisive coverage</dt>
              <dd>
                {report
                  ? `${String(summarizeReview(report.review).covered)} / ${String(summarizeReview(report.review).required)} required items`
                  : "No calibrated report"}
              </dd>
              <dt>Calibrated blockers</dt>
              <dd>{report ? report.review.blockingFindings.length : "Not available"}</dd>
            </dl>
          </article>
        ))}
      </div>
      <p className="book-note">
        {shared.length} REQUIRED statements match exactly across the reports. Requirement IDs are
        local to each review; unmatched wording is not assumed equivalent.
      </p>
      {shared.length > 0 && (
        <ul className="comparison-requirements">
          {shared.map((item) => (
            <li key={item.id}>{item.statement}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function SourceInspector({
  runId,
  requirementId,
  onOpen,
  onSelectRun,
}: {
  runId: string | null;
  requirementId: string | null;
  onOpen: (id: string, requirement?: string) => void;
  onSelectRun: (id: string) => void;
}) {
  const history = useResource("source-runs", (signal) =>
    request<RunHistory>("/v1/runs", { signal }),
  );
  return (
    <section className="library-page">
      <div className="library-toolbar">
        <label className="search-field">
          Candidate snapshot
          <select value={runId ?? ""} onChange={(event) => onSelectRun(event.target.value)}>
            <option value="">Select a persisted run</option>
            {history.data?.runs.map((run) => (
              <option key={run.runId} value={run.runId}>
                {run.runId} · {label(run.outcome)}
              </option>
            ))}
          </select>
        </label>
        <span className="read-only-label">Read-only / no execution</span>
      </div>
      {history.error && <ResourceState error={history.error} retry={history.retry} />}{" "}
      {runId ? (
        <SnapshotView
          key={`${runId}:${requirementId ?? ""}`}
          runId={runId}
          requirementId={requirementId}
          onOpen={onOpen}
        />
      ) : (
        <div className="paper library-empty">
          <h2>The source stays intact.</h2>
          <p>
            Select a run to inspect its content-addressed snapshot. File previews are verified
            against the stored manifest before display.
          </p>
        </div>
      )}
    </section>
  );
}

function SnapshotView({
  runId,
  requirementId,
  onOpen,
}: {
  runId: string;
  requirementId: string | null;
  onOpen: (id: string, requirement?: string) => void;
}) {
  const resource = useResource(`snapshot:${runId}`, async (signal) => {
    const snapshot = await request<CandidateSnapshotManifest>(
      `/v1/runs/${encodeURIComponent(runId)}/snapshot`,
      { signal },
    );
    const status = await api.status(runId, signal);
    const report = status.status === "SUCCEEDED" ? await api.report(runId, signal) : null;
    return { snapshot, report };
  });
  const [file, setFile] = useState("");
  const [search, setSearch] = useState("");
  if (!resource.data) return <ResourceState error={resource.error} retry={resource.retry} />;
  const { snapshot, report } = resource.data;
  const requirement = report?.review.requirements.find((item) => item.id === requirementId);
  const context =
    report?.review.evidence.filter(
      (item) => !requirementId || item.requirementIds.includes(requirementId),
    ) ?? [];
  const recordedText = context
    .map((item) => `${item.reproduction} ${item.observedBehavior}`)
    .join("\n");
  const referenced = snapshot.files.filter((entry) => recordedText.includes(entry.relativePath));
  const selected = file || referenced[0]?.relativePath || snapshot.specPath;
  return (
    <div className="snapshot-workbench">
      <aside className="source-index">
        <header>
          <h2>Source inventory</h2>
          <p>
            {snapshot.fileCount} files · {(snapshot.totalBytes / 1024).toFixed(1)} KiB
          </p>
        </header>
        <label>
          Find a file
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter paths"
          />
        </label>
        <nav aria-label="Snapshot files">
          {snapshot.files
            .filter((entry) => entry.relativePath.toLowerCase().includes(search.toLowerCase()))
            .map((entry) => (
              <button
                key={entry.relativePath}
                aria-current={selected === entry.relativePath ? "true" : undefined}
                onClick={() => setFile(entry.relativePath)}
              >
                {entry.relativePath}
                <small>{entry.size} bytes</small>
              </button>
            ))}
        </nav>
        {snapshot.files.every(
          (entry) => !entry.relativePath.toLowerCase().includes(search.toLowerCase()),
        ) && <p>No paths match.</p>}
      </aside>
      <SourceFile key={`${runId}:${selected}`} runId={runId} file={selected} />
      <aside className="paper source-context">
        <h2>Evidence context</h2>
        {requirement && (
          <p className="source-requirement">
            <strong>{requirement.id}</strong> {requirement.statement}
          </p>
        )}
        <p>Paths below are literal mentions in recorded evidence, not inferred line-level proof.</p>
        {referenced.map((entry) => (
          <button
            key={entry.relativePath}
            className="source-path-link"
            onClick={() => setFile(entry.relativePath)}
          >
            {entry.relativePath}
          </button>
        ))}
        {referenced.length === 0 && (
          <p>No literal source paths were recorded for this selection.</p>
        )}
        {context.map((item) => (
          <details key={item.id}>
            <summary>
              {item.id} · {item.disposition}
            </summary>
            <p>{item.observedBehavior}</p>
            <p className="mono">{item.reproduction}</p>
          </details>
        ))}
        <h3>Return to the ledger</h3>
        {report ? (
          report.review.requirements.map((item) => (
            <button
              className="source-requirement-link"
              key={item.id}
              onClick={() => onOpen(runId, item.id)}
            >
              <strong>{item.id}</strong>
              <span>{item.statement}</span>
            </button>
          ))
        ) : (
          <p>This run has no calibrated report. Its source remains inspectable.</p>
        )}
      </aside>
    </div>
  );
}
export function SourceFile({ runId, file }: { runId: string; file: string }) {
  const resource = useResource(`source:${runId}:${file}`, (signal) =>
    request<{ relativePath: string; sha256: string; size: number; content: string }>(
      `/v1/runs/${encodeURIComponent(runId)}/source?path=${encodeURIComponent(file)}`,
      { signal },
    ),
  );
  const [firstLine, setFirstLine] = useState(0);
  if (!resource.data) return <ResourceState error={resource.error} retry={resource.retry} />;
  const lines = resource.data.content.split(/\r?\n/u);
  return (
    <article className="source-reader" aria-label="Source preview">
      <header>
        <h2>{file}</h2>
        <p className="hash-value">SHA-256 {resource.data.sha256}</p>
        <span>{resource.data.size} bytes · verified UTF-8 preview</span>
        {lines.length > 500 && (
          <div className="source-pagination">
            <span>
              Lines {firstLine + 1}–{Math.min(firstLine + 500, lines.length)} of {lines.length}
            </span>
            <button
              className="text-button"
              disabled={firstLine === 0}
              onClick={() => setFirstLine(Math.max(0, firstLine - 500))}
            >
              Previous lines
            </button>
            <button
              className="text-button"
              disabled={firstLine + 500 >= lines.length}
              onClick={() => setFirstLine(firstLine + 500)}
            >
              Next lines
            </button>
          </div>
        )}
      </header>
      <div className="code-scroll" tabIndex={0} aria-label={`Read-only source ${file}`}>
        <pre>
          {lines.slice(firstLine, firstLine + 500).map((line, index) => (
            <span className="source-line" key={index}>
              <span className="line-number" aria-hidden="true">
                {firstLine + index + 1}
              </span>
              <code>{line || " "}</code>
            </span>
          ))}
        </pre>
      </div>
    </article>
  );
}

interface SettingsData {
  address: string;
  model: string;
  reasoning: string;
  profile: VerificationReport["verifier"];
  maxArchiveBytes: number;
  sourcePreviewBytes: number;
  isolation: string;
  storage: string;
  configuration: string;
}
export function Settings() {
  const settings = useResource("settings", (signal) =>
    request<SettingsData>("/v1/settings", { signal }),
  );
  const [diagnostic, setDiagnostic] = useState<{
    available: boolean;
    checkedAt: string;
    message: string;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  async function check() {
    setChecking(true);
    setError("");
    try {
      setDiagnostic(await request("/v1/diagnostics", { method: "POST" }));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Diagnostic request failed.");
    } finally {
      setChecking(false);
    }
  }
  if (!settings.data) return <ResourceState error={settings.error} retry={settings.retry} />;
  const data = settings.data;
  return (
    <div className="settings-layout">
      <section className="paper settings-sheet">
        <header>
          <h2>Effective service configuration</h2>
          <p>Read from the running backend. No credentials are exposed.</p>
        </header>
        <dl className="settings-list">
          {[
            ["Listener", data.address],
            ["Controlled model", `${data.model} / ${data.reasoning}`],
            ["Verifier", `${data.profile.selectedIteration} · frozen`],
            ["Execution boundary", data.isolation],
            ["Compressed ZIP limit", `${String(data.maxArchiveBytes / 1024 / 1024)} MiB`],
            ["Source preview limit", `${String(data.sourcePreviewBytes / 1024)} KiB · UTF-8 only`],
            ["Persistence", data.storage],
          ].map(([name, value]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <h3>Frozen identity</h3>
        <dl className="settings-list">
          {["promptHash", "configHash", "gateHash"].map((key) => (
            <div key={key}>
              <dt>{key.replace("Hash", " SHA-256")}</dt>
              <dd className="hash-value">
                {data.profile[key as "promptHash" | "configHash" | "gateHash"]}
              </dd>
            </div>
          ))}
        </dl>
        <p className="book-note">{data.configuration}</p>
      </section>
      <aside className="diagnostics">
        <h2>Check the boundary.</h2>
        <p>
          The API is reachable. New verification also requires the isolated executor. Reading saved
          reports does not.
        </p>
        <div className={`diagnostic-status ${diagnostic?.available ? "ready" : ""}`} role="status">
          <strong>
            {checking
              ? "Checking isolation…"
              : diagnostic
                ? diagnostic.available
                  ? "Isolation preflight passed"
                  : "Isolation unavailable"
                : "Isolation not checked"}
          </strong>
          <p>
            {diagnostic?.message ??
              "Run a real local preflight. It does not start Docker, execute candidate code, or call the model."}
          </p>
          {diagnostic && (
            <time dateTime={diagnostic.checkedAt}>Checked {date(diagnostic.checkedAt)}</time>
          )}
        </div>
        <button className="button primary" disabled={checking} onClick={() => void check()}>
          {checking ? "Checking…" : "Check isolation"}
        </button>
        {error && <p role="alert">{error}</p>}
        <p className="small muted">
          This is a point-in-time infrastructure check, not a successful authentication or
          model-response guarantee.
        </p>
      </aside>
    </div>
  );
}

export type { VerificationStatusView };
