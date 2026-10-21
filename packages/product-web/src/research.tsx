import { useState } from "react";
import type { ResearchStudy } from "../../product-service/src/research-archive.js";
import { request } from "./api.js";
import { useResource, ResourceState, elapsed, date } from "./library.js";

const metricLabels: Record<string, string> = {
  classificationAccuracy: "Classification accuracy",
  mutantDetectionRate: "Mutant detection",
  goldenAcceptanceRate: "Golden acceptance",
  falseAcceptRate: "False accepts",
  falseRejectRate: "False rejects",
  unknownRate: "UNKNOWN rate",
  fctr: "Semantic conformity",
  falseDoneRate: "False-Done rate",
};
export function Research() {
  const catalog = useResource("research-catalog", (signal) =>
    request<{ studies: { id: string; title: string; context: string }[] }>("/v1/research", {
      signal,
    }),
  );
  const [selected, setSelected] = useState("final-holdout-evaluation");
  return (
    <section className="library-page">
      <div className="replay-banner">
        <strong>REPLAY / immutable research archive</strong>
        <p>
          Historical experiments, not live verification. All results below are recorded evidence;
          browsing does not run a model or oracle.
        </p>
      </div>
      {!catalog.data ? (
        <ResourceState error={catalog.error} retry={catalog.retry} />
      ) : (
        <>
          <div className="library-toolbar">
            <label className="search-field">
              Recorded study
              <select value={selected} onChange={(event) => setSelected(event.target.value)}>
                {catalog.data.studies.map((study) => (
                  <option key={study.id} value={study.id}>
                    {study.title}
                  </option>
                ))}
              </select>
            </label>
            <span className="read-only-label">Frozen / read-only</span>
          </div>
          <Study key={selected} id={selected} />
        </>
      )}
    </section>
  );
}
function Study({ id }: { id: string }) {
  const resource = useResource(`study:${id}`, (signal) =>
    request<ResearchStudy>(`/v1/research/${encodeURIComponent(id)}`, { signal }),
  );
  const [trace, setTrace] = useState("");
  if (!resource.data) return <ResourceState error={resource.error} retry={resource.retry} />;
  const study = resource.data;
  return (
    <>
      <article className="paper research-sheet">
        <header className="book-heading">
          <div>
            <h2>{study.title}</h2>
            <p>{study.context}</p>
          </div>
          <span className="replay-stamp">REPLAY</span>
        </header>
        {id === "final-holdout-evaluation" && (
          <div className="research-conclusion">
            <h3>Equal accuracy. Different errors.</h3>
            <p>
              V0 and A1.1 each classified 8 of 12 sealed candidates correctly. A1.1 did not improve
              final accuracy. Development gains did not translate into a higher holdout score.
            </p>
          </div>
        )}
        {id === "dev-baselines" && (
          <p className="book-note">
            Both builders achieved 4/4 semantic conformance. Explicit self-review increased runtime
            by approximately 47% without an observed conformity improvement. This generation
            experiment is not a reviewer classification score.
          </p>
        )}
        <div className="research-arms">
          {study.arms.map((arm) => (
            <section key={arm.name}>
              <h3>{arm.name}</h3>
              {typeof arm.metrics.correctCount === "number" ? (
                <p className="research-score">
                  {arm.metrics.correctCount}
                  <span> / {arm.metrics.candidateCount} classified correctly</span>
                </p>
              ) : (
                <p className="research-score">
                  {arm.metrics.semanticPasses}
                  <span> / 4 semantically conformant</span>
                </p>
              )}
              <dl>
                {Object.entries(metricLabels)
                  .filter(([key]) => typeof arm.metrics[key] === "number")
                  .map(([key, label]) => (
                    <div key={key}>
                      <dt>{label}</dt>
                      <dd>{((arm.metrics[key] ?? 0) * 100).toFixed(1)}%</dd>
                    </div>
                  ))}
                <div>
                  <dt>UNKNOWN outputs</dt>
                  <dd>
                    {arm.metrics.unknownVerdicts ?? arm.metrics.unknownRuns ?? "Not recorded"}
                  </dd>
                </div>
                <div>
                  <dt>Total review runtime</dt>
                  <dd>
                    {typeof arm.metrics.totalRuntimeMs === "number"
                      ? elapsed(arm.metrics.totalRuntimeMs)
                      : "Not recorded"}
                  </dd>
                </div>
              </dl>
            </section>
          ))}
        </div>
        <h3 className="research-table-heading">Every candidate, including limitations</h3>
        <p className="book-note">
          PASS / FAIL are deterministic oracle outcomes. UNKNOWN review output is not semantic
          failure. These small development and holdout sets do not establish statistical
          significance.
        </p>
        <div className="data-table-scroll" tabIndex={0} aria-label="Historical results table">
          <p className="table-scroll-hint">
            Scroll horizontally for recorded decisions and failure codes. Keyboard: focus this table
            and use the arrow keys.
          </p>
          <table className="research-table">
            <thead>
              <tr>
                <th scope="col">Candidate / task</th>
                <th scope="col">Truth</th>
                <th scope="col">Visible / oracle</th>
                <th scope="col">Recorded decisions</th>
                <th scope="col">Semantic failure code</th>
              </tr>
            </thead>
            <tbody>
              {study.rows.map((row) => (
                <tr key={row.candidateId}>
                  <th scope="row">
                    {row.candidateId}
                    <small>{row.taskId}</small>
                  </th>
                  <td>{row.truthClass}</td>
                  <td>
                    {row.visible.toUpperCase()} / {row.oracle.toUpperCase()}
                  </td>
                  <td>
                    {row.decisions.map((decision) => (
                      <div className="research-decision" key={decision.arm}>
                        <strong>
                          {decision.arm} · {decision.verdict}
                        </strong>
                        <span>
                          {decision.verdict === "UNKNOWN"
                            ? "UNKNOWN / no valid classification"
                            : decision.correct === null
                              ? "Not a classification score"
                              : decision.correct
                                ? "Correct"
                                : "Incorrect"}{" "}
                          · {elapsed(decision.runtimeMs)}
                        </span>
                      </div>
                    ))}
                  </td>
                  <td className="mono">{row.failureCode ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="archive-provenance">
          <span>Completed {date(study.completedAt)}</span>
          <span className="hash-value">Published result SHA-256 (canonical LF) {study.sha256}</span>
          <span>
            Integrity verified by the service before display. Published source evidence is never
            rewritten.
          </span>
        </footer>
      </article>
      {study.traces.length > 0 ? (
        <section className="trajectory-section">
          <header>
            <div>
              <h2>Open the recorded reasoning.</h2>
              <p>
                Sanitized structured events from the sealed evaluation. No private oracle source or
                raw authentication logs are served.
              </p>
            </div>
            <span className="replay-stamp">REPLAY</span>
          </header>
          <label>
            Recorded trajectory
            <select
              aria-label="Recorded trajectory"
              value={trace}
              onChange={(event) => setTrace(event.target.value)}
            >
              <option value="">Select a frozen trajectory</option>
              {study.traces.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          {trace && <Trajectory key={trace} id={trace} />}
        </section>
      ) : (
        <p className="muted small">
          The complete published result table is available above. Trajectory browsing in this
          edition is enabled for the final evaluation's 24 sanitized traces.
        </p>
      )}
    </>
  );
}
interface TracePage {
  mode: "REPLAY";
  offset: number;
  total: number;
  lines: string[];
  sha256: string;
}
function Trajectory({ id }: { id: string }) {
  const [offset, setOffset] = useState(0);
  const resource = useResource(`trace:${id}:${String(offset)}`, (signal) =>
    request<TracePage>(`/v1/research-traces/${encodeURIComponent(id)}?offset=${String(offset)}`, {
      signal,
    }),
  );
  if (!resource.data) return <ResourceState error={resource.error} retry={resource.retry} />;
  const data = resource.data;
  return (
    <article className="trace-reader">
      <header>
        <h3>REPLAY · {id}</h3>
        <p>
          Recorded events {offset + 1}–{Math.min(offset + data.lines.length, data.total)} of{" "}
          {data.total}. This is not a live activity stream.
        </p>
        <p className="hash-value">SHA-256 (canonical LF) {data.sha256}</p>
      </header>
      <ol start={offset + 1}>
        {data.lines.map((line, index) => {
          let title = "Recorded event";
          try {
            const event = JSON.parse(line) as { type?: string; item?: { type?: string } };
            title = `${event.type ?? title}${event.item?.type ? ` / ${event.item.type}` : ""}`;
          } catch {
            /* Keep malformed historical lines visible, never invent replacements. */
          }
          return (
            <li key={offset + index}>
              <details>
                <summary>{title}</summary>
                <pre>
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(line) as unknown, null, 2);
                    } catch {
                      return line;
                    }
                  })()}
                </pre>
              </details>
            </li>
          );
        })}
      </ol>
      <div className="trace-pagination">
        <button
          className="button secondary"
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - 10))}
        >
          Previous events
        </button>
        <button
          className="button secondary"
          disabled={offset + 10 >= data.total}
          onClick={() => setOffset(offset + 10)}
        >
          Next events
        </button>
      </div>
    </article>
  );
}
