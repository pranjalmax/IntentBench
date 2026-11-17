import type { ReactNode } from "react";
import { ReplayData } from "./replay-data.js";
import { applicationBase } from "./edition.js";
import { useResource, ResourceState } from "./library.js";
import type { VerificationReport } from "./api.js";

export function ReplayAcceptance({
  children,
}: {
  children: (data: {
    report: VerificationReport;
    downloads: { json: string; md: string };
  }) => ReactNode;
}) {
  const resource = useResource("acceptance-replay", (signal) =>
    new ReplayData(applicationBase).acceptance(signal),
  );
  if (!resource.data) return <ResourceState error={resource.error} retry={resource.retry} />;
  return (
    <>
      <div className="replay-banner">
        <strong>REPLAY / genuine saved acceptance evidence</strong>
        <p>
          {resource.data.provenance} COMPLETE is a recorded verifier judgment, not guaranteed
          correctness.
        </p>
      </div>
      {children(resource.data)}
      <p className="muted small replay-availability-note">
        The original source snapshot and local run database are not published. Source inspection and
        run history are unavailable in this demo. No files or activity have been reconstructed.
      </p>
    </>
  );
}

export function ReplayUnavailable({ source = false }: { source?: boolean }) {
  return (
    <section className="paper library-empty">
      <span className="replay-stamp">REPLAY / read-only</span>
      <h2>
        {source ? "The source snapshot is not published." : "Local run history is not published."}
      </h2>
      <p>
        {source
          ? "The saved acceptance report contains authentic evidence and literal source references. Its full candidate snapshot is unavailable in this public edition; no replacement source is fabricated."
          : "Research comparisons and the saved acceptance report are available. They are historical evidence, not newly executed jobs or a seeded local database."}
      </p>
    </section>
  );
}

export function ReplayDetails() {
  return (
    <section className="paper settings-sheet">
      <header>
        <span className="replay-stamp">PUBLIC REPLAY</span>
        <h2>A static record. An inspectable result.</h2>
      </header>
      <p>
        This website serves reviewed, hash-checked historical evidence. It has no verification
        backend, upload receiver, Docker runtime, account system or model connection.
      </p>
      <dl className="settings-list">
        <div>
          <dt>Published studies</dt>
          <dd>Six frozen result tables</dd>
        </div>
        <div>
          <dt>Trajectories</dt>
          <dd>Six authentic sanitized traces from the final evaluation</dd>
        </div>
        <div>
          <dt>Acceptance report</dt>
          <dd>One genuine saved local report, with JSON and Markdown exports</dd>
        </div>
        <div>
          <dt>Integrity</dt>
          <dd>
            Original evidence hashes checked during build; downloaded data hashes checked before
            display
          </dd>
        </div>
        <div>
          <dt>Final accuracy</dt>
          <dd>V0 8/12 · A1.1 8/12. No final accuracy improvement.</dd>
        </div>
      </dl>
      <p>
        Live verification belongs to the separate local application and requires its validated
        isolation prerequisites. Browsing this demo never starts a verification.
      </p>
      <a className="button paper-button" href="https://github.com/pranjalmax/IntentBench">
        Source and local setup
      </a>
    </section>
  );
}
