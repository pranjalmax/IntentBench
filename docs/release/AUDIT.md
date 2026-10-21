# Public export audit

This candidate is prepared for owner review, **not cleared for publication**.
Project licensing has not been chosen or applied. No remote, repository visibility
change, GitHub publication or deployment occurs during preparation.

## Export boundary

A concrete per-file allowlist selected product source/tests, required filesystem
utilities, frozen gate/profile and reviewed published evidence. Everything else
was excluded. There are no sealed task repositories, oracle/truth source, variants,
experiment launch/scoring scripts, private data, credentials or original Git objects.

[Public file manifest](../../public-file-manifest.json) lists every intended source
file and canonical digest. A separate private audit package retains the complete
included/adapted/excluded original-file inventory; it is deliberately not part of
this public source export because excluded sealed filenames are not publishable
material. Ignored authentication/data/history/cache roots were opaque exclusions,
not traversed to inventory their sensitive contents.

The default edition browses authentic REPLAY and disables candidate uploads before
intake. No historical successful product run is fabricated or seeded. Live mode
requires explicit opt-in and retains existing isolation checks.

## Dependency and licensing findings

The registry audit initially reported two high-severity development-only transitive
packages: brace-expansion and fast-uri. Compatible patches 5.0.12 and 3.1.9 were
applied only to this export. The subsequent registry audit reported zero known
vulnerabilities. This is a dated registry check, not a permanent security guarantee.

[License inventory](../../third-party/licenses.json) records all 266 locked package
locations with no missing license declarations. There are 216 installed locations
on the audited Windows platform and 50 optional platform entries. [Notices](../../third-party/NOTICES.md)
retain 132 unique available upstream notice texts. Nine installed packages have
no top-level notice file; their declared licensing is recorded, not silently inferred
from a fabricated notice. Additional upstream/source-availability review is needed
before distributing bundled dependencies or images.

MPL development tooling and OFL font terms remain upstream terms. No project license
grant is made by collecting notices. See [license decision](../../LICENSE-DECISION.md).

## Minimal CI

The [workflow](../../.github/workflows/ci.yml) uses SHA-pinned official checkout/setup
actions, read-only permissions, no persisted checkout credentials, no secrets and
no `pull_request_target`. It installs with lifecycle scripts disabled, then runs
format/lint/typecheck/tests/build, public-file audit and a dependency audit.
No model, Docker, deployment, package publishing or artifact upload job is configured.
The [GitHub secure-use reference](https://docs.github.com/en/actions/reference/security/secure-use)
informs these controls. GitHub-hosted execution remains unverified until publication
is separately approved; local fresh-clone checks are distinct evidence.

## Remaining blockers / scope limits

- Owner approval of project license, copyright identity and publication rights for
  source, documentation, screenshots and sanitized model output.
- Separate approval before any public repository or deployment action.
- Exact pinned live-image distribution, SBOM/CVE/notice review and fresh isolated
  live execution were not performed. A rebuilt image may not match and is refused.
- Optional-platform notice coverage and absent top-level dependency notices are
  disclosed; this source export does not redistribute their binaries.
- Privacy scanning plus visual screenshot inspection is not a proof against all
  secrets or steganographic data. No ignored credential store is read to conduct it.

The canonical private repository and frozen research remain unchanged. Both final
scores stay 8/12; no model experiment, oracle scoring or post-holdout tuning occurs.
Reusable export/packaging lessons are recorded locally; no global tool/skill upgrades
are installed.
