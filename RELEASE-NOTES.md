# Public source release candidate — unpublished

This is a clean, independently initialized source export, not the internal research
repository or its Git history. No remote, release tag, public repository or deployment
is created. Project licensing remains pending in [LICENSE-DECISION.md](LICENSE-DECISION.md).

## Included

- Product core/service/workbench, relevant tests, two required filesystem utilities,
  and the byte-identical frozen A1.1 gate/prompt/config.
- Default recorded-only mode: authentic historical research browsing without Docker
  or authentication, explicit REPLAY labels and no candidate upload execution.
- Explicit live opt-in retains loopback-only serving, dedicated authentication,
  image/profile pins and the existing sandbox. No host-execution fallback.
- Six published result tables, six reviewed sanitized full trajectories, four
  authentic screenshots and genuine non-benchmark acceptance exports.
- Portable setup/security/architecture/research documentation and read-only CI.

## Excluded

Sealed tasks/oracles/truth/overlays, original Git objects, experiment launch/scoring
scripts, authentication, private saved data, internal plans/logs, unreviewed traces,
build outputs and installed dependencies. The published retrospective class labels
in reviewed result tables are evidence, not sealed oracle/truth source files.

## Changes limited to the public edition

Build no longer compiles or requires oracles. Public profile and research paths are
standalone. Recorded mode rejects POST uploads before intake; live mode must be
explicitly enabled. Development-only transitive `brace-expansion` and `fast-uri`
were patched to 5.0.12 and 3.1.9 respectively after registry audit findings.
The frozen verifier gate/profile and all published scores/trajectories are unchanged.

## Measured result / limits

Final accuracy remains **V0 8/12, A1.1 8/12**. A1.1 accepted one extra golden but had
one UNKNOWN and 5.175× review runtime; no accuracy improvement is claimed. COMPLETE
is a verifier judgment, not guaranteed correctness.

Live execution was not rerun for this export. A fresh-machine rebuild of the
reference image recipe may not reproduce the pinned image ID, and must be refused
rather than silently trusted. Image distribution/SBOM and live isolation validation
remain separate blockers for a turnkey live edition. Recorded browsing and the
source build do not require that image.
