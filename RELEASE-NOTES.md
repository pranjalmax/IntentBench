# Public source release candidate — unpublished

This is a clean, independently initialized source export, not the internal research
repository or its Git history. The existing GitHub repository remains private.
No public release, release tag or application deployment is created by this update.
IntentBench is licensed under the [MIT License](LICENSE), approved by
the owner with Copyright (c) 2026 Pranjal Srivastava. [License details](LICENSE-DECISION.md).

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

The October 29 dependency remediation upgrades Vitest and its matching helpers to
4.1.12 and jsdom's Undici to 7.30.1. Supported npm overrides fix the reproduced
peer-resolution crash and select the compatible Undici patch. No production package
version changed. Full and production-only registry audits report zero findings.
Regression checks reject the original vulnerable versions and mixed test cohorts;
CI now uses strict peer validation and audits all severities. Exact advisories and
limitations are in the [dependency report](docs/release/DEPENDENCIES.md).

The November 17 refresh addresses **GHSA-g3hv-75wg-m249** by upgrading ESLint
10.9.1 → 10.15.0 and typescript-eslint 8.68.0 → 8.73.0. Their supported upstream
dependency ranges resolve minimatch 11.0.9; no minimatch override is used.
All changed packages are development dependencies. Full and production-only npm
audits report zero findings at this refresh. Regression checks reject vulnerable
top-level and nested minimatch copies; third-party inventories/notices are updated.
The application, frozen verifier and historical experimental results are unchanged.

Final accuracy remains **V0 8/12, A1.1 8/12**. A1.1 accepted one extra golden but had
one UNKNOWN and 5.175× review runtime; no accuracy improvement is claimed. COMPLETE
is a verifier judgment, not guaranteed correctness.

Live execution was not rerun for this export. A fresh-machine rebuild of the
reference image recipe may not reproduce the pinned image ID, and must be refused
rather than silently trusted. Image distribution/SBOM and live isolation validation
remain separate blockers for a turnkey live edition. Recorded browsing and the
source build do not require that image.
