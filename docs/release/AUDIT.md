# Public export audit

This source is stored in the existing **public** GitHub repository following the
owner-approved source release. The owner-approved
[MIT License](../../LICENSE) is applied. No visibility change or deployment is part
of dependency remediation.

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
applied only to this export. The subsequent October 21 registry audit reported zero
known vulnerabilities. That result is historical, not the current release-security status.

**October 29 remediation:** the initial refresh reported three affected development
package entries, representing ten unique upstream advisories. Vitest/mocker now
use 4.1.12 and jsdom's Undici uses 7.30.1. That refresh reported zero registry
findings. Production dependency versions were unchanged. This is not a claim that
every network exploit or the system/runtime image has been independently tested.

The npm `edgesOut` crash was reproduced and traced to a detached Vitest 5 node
encountered through optional wildcard peer resolution. A supported override matching
the exact direct Vitest 4 pin removes that path without skipping peer checks.
An equally supported jsdom-scoped override selects Undici's compatible patch.
Strict installation and the complete installed graph are validated; no global npm
change, `--force`, legacy-peer mode, audit suppression or manual lockfile rewrite
was used. See the [exact advisories, dependency chains, root cause and limits](DEPENDENCIES.md).

**November 17 remediation:** a fresh audit found nine moderate affected package
entries tracing to one advisory, **GHSA-g3hv-75wg-m249**. Compatible upstream
ESLint 10.15.0 and typescript-eslint 8.73.0 upgrades resolve minimatch 11.0.9 through
their own supported dependency ranges, without a minimatch override. Clean strict
installation and full/production-only audits pass with zero findings. All changed
lockfile nodes are development-only; production versions and application source
are unchanged. Earlier clean audits are historical snapshots, not promises about
future advisories.

[License inventory](../../third-party/licenses.json) records all 275 locked package
locations with no missing license declarations. There are 225 installed locations
on the audited Windows platform and 50 optional platform entries. [Notices](../../third-party/NOTICES.md)
retain current and previously reviewed upstream notice texts (134 active notice
groups in the refreshed tree). Eight installed packages have
no top-level notice file; their declared licensing is recorded, not silently inferred
from a fabricated notice. Additional upstream/source-availability review is needed
before distributing bundled dependencies or images.

MPL development tooling and OFL font terms remain upstream terms. No project license
grant is made by collecting notices. See [license decision](../../LICENSE-DECISION.md).

## Minimal CI

The [workflow](../../.github/workflows/ci.yml) uses SHA-pinned official checkout/setup
actions, read-only permissions, no persisted checkout credentials, no secrets and
no `pull_request_target`. It installs with lifecycle scripts disabled, then runs
format/lint/typecheck/tests/build, public-file audit, strict peer-graph checks,
and full plus production-only registry audits without a severity threshold.
No model, Docker, deployment, package publishing or artifact upload job is configured.
The [GitHub secure-use reference](https://docs.github.com/en/actions/reference/security/secure-use)
informs these controls. [Ubuntu run 41023529593](https://github.com/pranjalmax/IntentBench/actions/runs/41023529593)
passed all source gates at the preceding cleanup-fix commit. Each dependency update
must also pass its own complete [Actions run](https://github.com/pranjalmax/IntentBench/actions)
before being reported complete. Local installation checks are distinct evidence.

## Remaining blockers / scope limits

- Third-party and model-output publication rights remain subject to applicable
  upstream/account terms; the project MIT grant does not replace those terms.
- Source publication is complete. Website deployment requires separate approval;
  the static REPLAY feature does not deploy or enable Pages.
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
