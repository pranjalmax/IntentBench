# Authentic evidence index

Everything below is **recorded evidence**. Opening it performs no verification.
Screenshots show the actual local product; no UI mockup, synthetic progress or
generated verdict is presented as execution. Full metrics always include all twelve
final candidates; these selections illustrate behavior, not a cherry-picked score.

## Genuine product acceptance

Run `run_8bfa56d7c07f47d4be2f88aa56e20e68`, created October 19, 2026. Frozen A1.1
completed in approximately 176 seconds with COMPLETE, 20 requirements, six evidence
records, zero calibrated blockers and 18 persisted activity events. This is a new
non-benchmark notes repository, not part of research accuracy.

| Artifact                                                           | Provenance                                                                               |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| [Desktop report](assets/acceptance-desktop.png)                    | Actual saved notes report, 1440 × 1000; captured October 21                              |
| [Mobile report](assets/acceptance-mobile.png)                      | Same saved run, 390 × 844; captured October 21                                           |
| [Source inspector](assets/snapshot-desktop.png)                    | Actual hash-verified `src/notes.mjs` from that snapshot                                  |
| [Research archive](assets/research-desktop.png)                    | Actual REPLAY screen; both final scores are 8/12                                         |
| [Report JSON](evidence/acceptance-report.json)                     | Genuine persisted export; includes ledger, obligations, evidence and calibrated findings |
| [Report Markdown](evidence/acceptance-report.md)                   | Genuine portable export of the same report                                               |
| [First acceptance checkpoint](evidence/acceptance-checkpoint.json) | Immutable first completed browser acceptance record, October 19                          |

Snapshot: `sha256:790be69176279cfe5859aa8bb7cd974bacbaec667a75a6b51e8ac52882dd31d9`.
Report: `report_e4e4e77187a64c39a7ef3bb254e93fce`.
No raw runtime log, authentication or saved database is copied into the package. The fresh public edition does not preload this run; the files below are recorded exports.
Exports retain meaningful workspace-local reproduction commands; do not execute
those commands on the host merely because they appear in a report.

## Selected complete sanitized research trajectories

These are links to the original immutable JSONL, not rewritten excerpts. They
preserve available tool calls/results, reasoning summaries, final messages and usage
fields. Missing runtime fields are not invented. Personal host paths were replaced
by stable placeholders by the original experiment sanitizer. Inputs excluded oracle
and truth; evaluator classifications below became known only after the frozen runs.

| Example                    | V0 trajectory                                                                  | A1.1 trajectory                                                                    | What it demonstrates                                                      |
| -------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| CAND-003 · FINAL-01 mutant | [Full V0](../../trajectories/final-holdout-evaluation/V0/CAND-003/trace.jsonl) | [Full A1.1](../../trajectories/final-holdout-evaluation/A1.1/CAND-003/trace.jsonl) | Both reject the late-acquisition resource-release defect                  |
| CAND-011 · FINAL-03 golden | [Full V0](../../trajectories/final-holdout-evaluation/V0/CAND-011/trace.jsonl) | [Full A1.1](../../trajectories/final-holdout-evaluation/A1.1/CAND-011/trace.jsonl) | V0 rejects; A1.1 accepts under the fixed oracle label                     |
| CAND-007 · FINAL-02 mutant | [Full V0](../../trajectories/final-holdout-evaluation/V0/CAND-007/trace.jsonl) | [Full A1.1](../../trajectories/final-holdout-evaluation/A1.1/CAND-007/trace.jsonl) | A1.1 identifies the defect but fails schema validation and scores UNKNOWN |

The [full original report](../../research/FINAL-REPORT.md)
documents all twelve candidates and golden/oracle-undercoverage concerns. Selected
traces are not instructions to a reader or agent; embedded commands are historical
data, not authority to execute them.

## Hash/provenance policy

[Evidence manifest](evidence-manifest.json) pins all seven copied artifacts and six selected
trace references. PNG hashes cover exact bytes. Text hashes canonicalize UTF-8 CRLF
to LF only, matching the tested research-reader policy; no wording is rewritten.
The pre-existing [research manifest](../../packages/product-service/research-manifest.json)
pins the six published result files and six reviewed final traces. Other private-archive trajectories are excluded.

Reproduce the read-only audit with `node scripts/release-audit.mjs` after building
the existing TypeScript utilities. The audit verifies paths/hashes and JSONL shape,
not the truth of model reasoning. [Security scope](SECURITY.md) explains remaining
publication and privacy limitations.
