# Reviewed static REPLAY release policy

Reviewed November 17, 2026. This policy prepares a manual deployment path only.
This change does **not** merge the PR, enable Pages, dispatch a workflow or deploy.
Target after separate approval: `https://pranjalmax.github.io/IntentBench/`.

## Explicit unresolved risk

[GHSA-fc5q-39xc-vjpf / CVE-2026-112366](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)
is a high-severity denial of service in picomatch `<=4.0.7`. Installed 4.0.7 is
development-only. No patched release is published at this review. The complete
npm audit fails; the production-only audit is clean. See the exact
[dependency chains and upstream investigation](DEPENDENCIES.md).

This limited release accepts **build-time availability risk** for reviewed,
committed static inputs. It does not certify the toolchain safe for untrusted
glob patterns, public build jobs or arbitrary repositories. Dependencies and
their maintainers remain part of the supply-chain trust boundary. A compromised
maintainer, runner or dependency can invalidate this assessment.

## Why there is no untrusted matcher-input path in this build

The deployment workflow has no inputs and only accepts `workflow_dispatch` on
`pranjalmax/IntentBench` at `refs/heads/main`. Checkout is pinned to that dispatch's
commit SHA with credentials not persisted. It does not consume PR-head code,
artifacts from another workflow, uploaded archives, comments, URLs or user specs.
Reviewed changes on main are trusted build inputs; unreviewed PR code is not.

The relevant matcher call paths were inspected:

- Vitest uses fixed committed `packages/*/test/**/*.test.ts(x)` includes in
  `vitest.config.ts`. No caller supplies runtime glob patterns to this config.
- ESLint uses committed file/ignore patterns in `eslint.config.js`.
  typescript-eslint's project resolution receives the literal
  `./tsconfig.lint.json`, rather than a user-provided project glob.
- Vite reads the committed root/config, module graph and static assets.
  tinyglobby and fdir compile tool-provided patterns through picomatch. There is
  no authored `import.meta.glob` or public pattern-to-build endpoint.
- The replay builder reads pinned, sanitized evidence through the existing
  allowlist and hash-verifying readers. Evidence text, browser search strings,
  URL fragments and synthetic ZIP tests are not used as glob patterns. Tests do
  not execute submitted candidate programs on the host.
- Published files contain browser code, fonts and reviewed data, not the Node
  matcher/toolchain. The hosted UI has no upload or build endpoint, and browser
  tests reject API, external and mutation requests.

Thus no anonymous or candidate-controlled input reaches the vulnerable matcher
in the reviewed build/data flow. This is source/data-flow evidence, not an
exhaustive exploit proof or a claim that development-only vulnerabilities are
harmless. Any new dynamic glob input, build input source or dependency exposure
requires a new review before deployment.

## Required gates and visible failure

The [workflow](../../.github/workflows/pages-replay.yml) has three isolated jobs:

1. **Validate:** strict clean installation with lifecycle scripts disabled;
   formatting, lint, typecheck, complete tests, local and static builds;
   desktop/mobile/keyboard/accessibility/browser checks; public-source, privacy,
   license and frozen-evidence checks; peer validity; production-only npm audit;
   full-registry scoped-risk evaluation; final static artifact verification.
2. **Full audit:** independently runs ordinary `npm audit` and fails normally.
   No `continue-on-error`, severity threshold, advisory hiding or false green
   audit status is used. The existing push/PR full-audit CI is unchanged.
3. **Deploy:** requires successful Validate, main and this repository; receives
   only the same-run, same-attempt Pages artifact. No source checkout, npm,
   backend, Docker, candidate code or model execution occurs in this job.

The scoped evaluator prints all registry findings and labels the result
`PASS_WITH_REVIEWED_DEV_RISK`, with `fullAudit: FAIL`. It accepts only normal
audit completion and findings whose every path resolves to this exact advisory,
on exclusively development-only lockfile nodes, with reviewed picomatch 4.0.7.
Any other advisory, changed severity or picomatch version, production node, malformed result,
dependency-path inconsistency or audit/network/process error blocks the release.
A clean full audit needs no exception. Focused tests cover these decisions.

The independent Full audit job is deliberately not a dependency of Deploy;
the scoped evaluator in Validate is. **The overall manual workflow remains red
while Full audit fails, even if the permitted static deployment succeeds.**
Inspect individual conclusions; do not describe that run as all-green CI.

The last command before upload is `audit:replay`. Its failure prevents upload;
failed/skipped/cancelled Validate prevents Deploy. Only `dist/replay/` is
uploaded, with a run/attempt-specific name and one-day retention. No parent
`dist/`, arbitrary artifact selector or backend fallback is accepted. The
existing audit rejects symlinks, hardlinks, unexpected files, privacy patterns,
changed evidence, incorrect data hashes and altered final research scores.
There is no failure bypass or unverified-artifact fallback.

## Permissions and activation prerequisites

Default permissions are empty. Validation and raw audit receive only
`contents: read`; deployment alone gets `pages: write` and `id-token: write`.
Official actions are pinned to reviewed commit SHAs. GitHub's ephemeral job
token and OIDC identity are necessary to publish Pages; there are **no custom
secrets, Codex authentication, API keys or model credentials** in this workflow.
Build jobs receive no deployment permission. Runs are serialized without
cancelling an active release. Jobs have bounded timeouts.

Before a future separately authorized publication:

1. Review/merge this PR; recheck the advisory and available upstream fixes.
   Adopt a compatible verified patch and remove this exception when available.
   Do not reinterpret a new advisory as covered by this one.
2. Ensure main receives only reviewed changes. Configure the `github-pages`
   environment to allow main only and require owner approval for deployment.
   These GitHub settings are activation prerequisites, not changes made here.
3. With separate approval, enable Pages with GitHub Actions as its source.
   This workflow does not call a Pages-enable API or use automatic configuration.
4. Manually run this workflow on main. Inspect every Validate gate and the raw
   audit failure. An unknown finding blocks Deploy even though the raw audit
   job is independent. If Pages is unavailable, fail rather than fall back.
5. After an authorized deployment, verify the public URL, downloads, base paths
   and read-only behavior. Actual Pages deployment has not been tested by this PR.

This exception does not authorize a hosted verifier, API server, upload execution,
live authentication or distribution of the frozen container image. Local serving
and live sandbox checks remain unchanged. Both historical final systems still
score 8/12; this release policy changes no experimental result.

## Implementation validation

The strict clean installation, formatting, lint, typecheck, complete existing
test suite, both builds and peer validation pass locally. The added policy suite
has 19 passing cases, including the reviewed exception, a truly clean audit and
rejection of unknown/additional advisories, production exposure, changed versions,
malformed/inconsistent reports, invalid dependency paths and interrupted audits.
One existing POSIX-only filesystem test is skipped on Windows and runs on Linux CI.

The real static browser gate passes at 1440px and 390px: comparisons, trace
pagination, refreshed deep links, keyboard requirement navigation and original
JSON/Markdown downloads, with zero axe violations, forbidden requests or console
errors. Artifact verification passes for 32 static files / 15 data files. Deliberate
evidence-byte alteration and an unexpected backend file each fail the existing
artifact audit; restoring the generated files restores a passing result.
The source/privacy/license audit verifies the explicit 164-file allowlist,
107 local documentation links, all frozen profile/evidence pins and no privacy
findings. Existing application, dependency lockfile, source CI and research
artifacts are unchanged. SHA-verified actionlint 1.7.12 validates both workflows.

Production-only audit is clean. The raw full audit exits 1 for this advisory;
the scoped policy reports `PASS_WITH_REVIEWED_DEV_RISK` while preserving
`fullAudit: FAIL`. GitHub Pages itself has not been enabled or exercised: workflow
syntax, gate behavior, static output and browser behavior are validated here,
not an actual publication or its environment configuration.
