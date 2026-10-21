# Architecture: one reasoning agent, deterministic boundaries

```text
Repository ZIP + specification path
  → bounded intake + exact-byte inventory
  → immutable candidate snapshot
  → durable run revisions + sanitized events
  → disposable Docker workspace / frozen A1.1 model profile
      specification → ledger → proof obligations → evidence → proposed findings
  → frozen deterministic gate
  → persisted report + requirement/evidence UI + JSON/Markdown exports
```

One reasoning agent, not a swarm. The product reuses tested benchmark path/inventory
utilities, the frozen A1.1 gate and the validated Docker runtime. Product reviews
have no hidden semantic oracle or automatic repair.

| Layer           | Responsibility                                                              | Code                                                                                     |
| --------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Core            | Versioned contracts, bounded intake, snapshots, durable state, gate adapter | [product-core](../../packages/product-core/src/index.ts)                                 |
| Service         | Isolated runner, lifecycle/cancel, events/reports, source and local API     | [product-service](../../packages/product-service/src/index.ts)                           |
| Web             | React/Vite frontend using real API responses                                | [product-web](../../packages/product-web/src/workbench.tsx)                              |
| Frozen verifier | Requirement/evidence protocol and deterministic calibration                 | [protocol](../../profiles/a1.1/prompt.md), [freeze](../../advanced-verifier/freeze.json) |
| Research        | Allowlisted, hash-pinned published results and sanitized traces             | [manifest](../../packages/product-service/research-manifest.json)                        |

## Persistence and execution

Snapshot identity includes sorted path/size/SHA-256 inventory and specification
path. Reopening rechecks integrity. Read-only attributes are defense in depth,
not a hostile same-user boundary; re-inventorying enforces identity.

Runs use append-only, fsynced revision files and optimistic revision checks.
PENDING → REVIEWING → CALIBRATING → SUCCEEDED has explicit FAILED/CANCELLED terminals.
Restart recovers interrupted jobs as infrastructure failures. This is local file
persistence plus in-process execution, not a distributed queue or model resumption.

The runner verifies prompt/config/gate byte hashes, copies the snapshot to disposable
storage and delegates commands only to the isolated runtime. Disposable storage is
cleaned on completion/failure/cancellation; the original snapshot remains available.
The reviewer must not edit implementation files, but its disposable workspace is
writable for targeted checks. Do not describe that whole mount as read-only.

## Evidence and calibration

REQUIRED entries have stable IDs and source statements. Obligations name observable
success. Evidence links requirements to supporting, contradicting or inconclusive
observations. Blockers need requirement/evidence references, reproduction and
expected/observed behavior. The gate checks schema, references, coverage and
calibration; advisories cannot independently force INCOMPLETE.

The gate is **structural**, not a semantic oracle. It cannot prove the model extracted
every requirement, interpreted scope correctly or accurately reported an experiment.
Final false rejects and structured-output brittleness remain documented limitations.

| Outcome                | Meaning                                                            |
| ---------------------- | ------------------------------------------------------------------ |
| COMPLETE               | Valid calibrated review, recorded coverage and no retained blocker |
| INCOMPLETE             | Valid calibrated review with a retained blocker                    |
| UNKNOWN                | Invalid/uncovered review; no valid semantic verdict                |
| INFRASTRUCTURE_FAILURE | Isolation/auth/capacity/timeout/process failure, not a code defect |
| CANCELLED              | User cancellation, not a fabricated report                         |

Events expose sanitized activity categories; raw model process output stays in
memory. Reports persist separately from run revisions. API routes cover create,
status, events, cancel, report, exports, history, source, settings, diagnostics and
research replay. Exact routes are in `packages/product-service/src/http-server.ts`. The service is loopback-
only with Host/Origin checks.

UI coverage joins persisted IDs to decisive evidence, not a new correctness score.
Source links use literal path mentions, not line attribution. Research browsing
never invokes a model or oracle.

## Frozen identity and historical metadata

A1.1 implementation: `7eb249805213e10ba904a6e774d61433ad23bfe8`.
Freeze commit: `e6dc7f5ce89e4ee41250d916579b10839b73ef51`.

- Prompt: `0b9c8e11296b1735a51b59f322a0d5fadaaeadf56688061056d3b0bf57c1d3c2`.
- Config: `f5ad0f7cca23196d73a76fa61c64b9b27d43382fd90d03cdd6fbc9609eab902a`.
- Gate: `9ea3ed019e8cb7d0b316960f4a0c5091aa69149a81f875c9166322c840764728`.

The historical freeze says `holdoutEvaluated: false` because it records the
pre-evaluation point; final evaluation subsequently completed. Some frozen schema
constants still name A1.0; external selection metadata identifies A1.1. Neither
issue is patched or used to change scores.
