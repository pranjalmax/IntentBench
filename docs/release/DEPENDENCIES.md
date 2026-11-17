# Dependency remediation — November 17, 2026

Scope: the public-source edition only. Frozen benchmarks, verifier profile/gate,
experimental trajectories and measured results were not changed or rerun.

## Current unresolved finding: picomatch repeated extglobs

**Reviewed November 17, 2026:** [GHSA-fc5q-39xc-vjpf / CVE-2026-112366](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)
affects picomatch `<=4.0.7`, including the installed deduplicated **4.0.7**.
The advisory lists **no patched version**. Repeated single-branch extglob patterns
can produce exponential regular-expression backtracking and event-loop denial of
service. This is a real unresolved high-severity development-tool risk.

The latest full registry report contains **13 high affected package entries for
this one advisory**, including inherited peer exposure through jest-dom; earlier
reports contained 12. These are not 13 independent CVEs. Every affected lockfile
node is `dev: true`; `npm audit --omit=dev` reports zero vulnerabilities.

| Installed development chain                               | Installed versions              |
| --------------------------------------------------------- | ------------------------------- |
| root → Vite → picomatch                                   | 8.3.4 → 4.0.7                   |
| root → Vitest → picomatch / tinyglobby / Vite             | 4.1.12 → 4.0.7 / 0.2.17 / 8.3.4 |
| root → @vitejs/plugin-react → Vite                        | 6.1.2 → 8.3.4                   |
| root → typescript-eslint → typescript-estree → tinyglobby | 8.73.0 → 8.73.0 → 0.2.17        |
| tinyglobby → fdir → picomatch; tinyglobby → picomatch     | 0.2.17 → 6.5.0 → 4.0.7          |
| root → jest-dom → Vitest (peer exposure)                  | 7.0.1 → 4.1.12                  |

The other inherited entries are the matching `@typescript-eslint/eslint-plugin`,
`parser`, `type-utils` and `utils` packages. Checked newer Vite 8.3.8 and Vitest
5.1.0 still request picomatch `^4.0.7`; an upgrade is not a verified fix. npm's
suggested older toolchains are not adopted. The open
[upstream PR #194](https://github.com/micromatch/picomatch/pull/194) explicitly does
not address all repeated-extglob cases and is not used as an unofficial patch.

No dependencies, overrides or production behavior are changed by the manual
release workflow. The full `npm audit` remains active and fails with its real
exit code. The [static-only release policy](STATIC-RELEASE-POLICY.md) records the
trust boundary, automated fail-closed exception checks and residual risk. It
does not apply to live verification, a public build service, unreviewed PR content
or new advisories. Recheck upstream before each publication; remove the exception
when a compatible verified patch can be adopted.

## Historical minimatch globparts remediation

The November 17 pre-release audit found **nine moderate package entries** tracing
to one advisory: [GHSA-g3hv-75wg-m249 / CVE-2026-118764](https://github.com/advisories/GHSA-g3hv-75wg-m249).
It affects minimatch `>=7.0.0 <11.0.1`; the installed version was 10.2.6. Attacker-controlled
glob patterns can amplify preprocessing work when `optimizationLevel >= 2`, causing
CPU/memory exhaustion. This is a tooling exposure when untrusted patterns reach
the affected matcher, not a finding that the product's loopback API invokes it.
All affected nodes are development-only; the production-only audit was already clean.

| Dependency chain                                                     | Before | After   |
| -------------------------------------------------------------------- | ------ | ------- |
| root → ESLint                                                        | 10.9.1 | 10.15.0 |
| ESLint → @eslint/config-array                                        | 0.23.5 | 0.23.6  |
| root → typescript-eslint and its matching helper cohort              | 8.68.0 | 8.73.0  |
| typescript-eslint → @typescript-eslint/typescript-estree → minimatch | 10.2.6 | 11.0.9  |
| ESLint → minimatch; ESLint → @eslint/config-array → minimatch        | 10.2.6 | 11.0.9  |

The other affected report entries were `@typescript-eslint/eslint-plugin`,
`@typescript-eslint/parser`, `@typescript-eslint/type-utils`,
`@typescript-eslint/typescript-estree` and `@typescript-eslint/utils`: inherited
exposure, not separate advisories.

The upstream package manifests explicitly adopt the patched major: ESLint 10.15.0
and config-array 0.23.6 require minimatch `^11.0.5`; typescript-estree 8.73.0 requires
`^11.0.1`. npm resolves one deduplicated 11.0.9. **No minimatch override was added.**
The pre-existing Vitest and jsdom/Undici overrides remain unchanged.
Node 22.20.0 meets ESLint's `^22.13.0` requirement; typescript-eslint supports
ESLint 10 and TypeScript `>=4.8.4 <6.1.0`, including the retained TypeScript 6.0.3.
The corresponding ESLint cache dependencies also change within its upstream
dependency graph. All lockfile changes are development-only, with production
dependency versions preserved.

Clean installation uses `npm ci --ignore-scripts --strict-peer-deps --no-audit --no-fund`.
At that remediation check, full and production-only registry audits returned zero findings. No force,
legacy-peer mode, advisory suppression or manually forced major override is used.
The tested public dependency gate rejects both the original 10.2.6 and a vulnerable
nested 11.0.0 copy. Lint/typecheck, full tests and the production build exercise
the actual upgraded tooling; no artificial high-load denial-of-service attack is
executed. Three unused resolver placeholders in mocked cancellation tests were
removed to satisfy the updated lint rule; cancellation behavior is unchanged.

The refreshed license inventory covers 275 lockfile locations (225 installed on
Windows, 50 optional platform entries), with no unknown declarations. Current
notice texts are included and previously collected notice bodies are retained.
See [validation](VALIDATION.md) and [GitHub Actions](https://github.com/pranjalmax/IntentBench/actions)
for source gates. Audits are point-in-time results; they do not cover the OS,
Node's bundled components or the frozen live Docker image.

## Historical October 29, 2026 remediation

The following findings and validation refer to the earlier dependency refresh.

## Exact findings and dependency paths

The baseline registry audit reported three affected package entries, representing
ten unique advisories. `vitest` inherited its mocker's findings; it was not an
eleventh independent advisory. All affected lockfile nodes were development-only.
The production-only audit reported zero findings even before remediation.

| Package / baseline      | Dependency path                                                                                     | Remediated version |
| ----------------------- | --------------------------------------------------------------------------------------------------- | ------------------ |
| `vitest@4.1.11`         | root development dependency; also optional peer of `@testing-library/jest-dom@7.0.1`                | `4.1.12`           |
| `@vitest/mocker@4.1.11` | root → `vitest` → `@vitest/mocker`                                                                  | `4.1.12`           |
| `undici@7.30.0`         | root → development `jsdom@29.1.1` → `undici`; jsdom is also Vitest's optional test-environment peer | `7.30.1`           |

Ranges below are the affected release ranges relevant to the installed major,
as reported by the registry. Other upstream major release lines can have different
affected ranges. Every row below is remediated in the reviewed dependency tree.

| Advisory                                                                                            | Package | Severity | Relevant affected range  | Guarantee at risk                                               |
| --------------------------------------------------------------------------------------------------- | ------- | -------- | ------------------------ | --------------------------------------------------------------- |
| [GHSA-qxg6-89mg-rqv8](https://github.com/vitest-dev/vitest/security/advisories/GHSA-qxg6-89mg-rqv8) | mocker  | Moderate | `>=2.1.0-beta.7 <4.1.12` | Code injection through unauthenticated manual mock registration |
| [GHSA-xp26-3454-mjgp](https://github.com/vitest-dev/vitest/security/advisories/GHSA-xp26-3454-mjgp) | mocker  | Moderate | `>=4.1.11 <4.1.12`       | Windows backslash traversal bypass of redirect allowlist        |
| [GHSA-4qv8-2p9j-2685](https://github.com/nodejs/undici/security/advisories/GHSA-4qv8-2p9j-2685)     | undici  | Moderate | `>=7.0.0 <7.30.1`        | Unbounded EventSource parser memory                             |
| [GHSA-f72v-6w45-q472](https://github.com/nodejs/undici/security/advisories/GHSA-f72v-6w45-q472)     | undici  | Moderate | `>=7.15.0 <7.30.1`       | Subresource integrity token case handling                       |
| [GHSA-xjj6-f33q-929c](https://github.com/nodejs/undici/security/advisories/GHSA-xjj6-f33q-929c)     | undici  | High     | `>=7.18.0 <7.30.1`       | Unhandled excessive content-encoding errors                     |
| [GHSA-4w7w-5xrc-9h26](https://github.com/nodejs/undici/security/advisories/GHSA-4w7w-5xrc-9h26)     | undici  | High     | `>=7.0.0 <7.30.1`        | Cross-origin redirect cache poisoning/disclosure                |
| [GHSA-2m5v-pch6-74hx](https://github.com/nodejs/undici/security/advisories/GHSA-2m5v-pch6-74hx)     | undici  | High     | `>=7.0.0 <7.30.1`        | Function-valued TLS verification options lost by Agent          |
| [GHSA-qrxm-fqhp-jwvm](https://github.com/nodejs/undici/security/advisories/GHSA-qrxm-fqhp-jwvm)     | undici  | High     | `>=7.0.0 <7.30.1`        | TLS 1.2 certificate-changing renegotiation denial of service    |
| [GHSA-9fm3-97px-rjf6](https://github.com/nodejs/undici/security/advisories/GHSA-9fm3-97px-rjf6)     | undici  | Moderate | `>=7.0.0 <7.30.1`        | Unbounded automatic WebSocket PONG buffering                    |
| [GHSA-55wc-3pg8-jfw6](https://github.com/nodejs/undici/security/advisories/GHSA-55wc-3pg8-jfw6)     | undici  | Moderate | `>=7.15.0 <7.30.1`       | Unhandled decompress-interceptor exception                      |

Production serving does not load Vitest/mocker or jsdom's Undici. The mocker issues
concern exposed development/test-server registration endpoints and filesystem/code
access. Undici's issues concern untrusted responses, redirects, WebSockets or TLS
peers when the affected APIs are used. Development-only classification limits this
product's runtime exposure; it does not make those packages safe to leave unpatched.

## Why npm crashed

The `edgesOut` exception occurred inside npm Arborist's `#loadPeerSet`, not in
candidate code or an IntentBench test. A small reproduction with Vitest 4.1.12,
Vite 8.3.4, jsdom 29.1.1, TypeScript and Node types reproduced it. A process-local
diagnostic identified a **detached `vitest@5.0.5` node** while resolving its optional
`@vitest/browser-preview@5.0.5` peer. Arborist dereferenced `node.parent.edgesOut`
although that candidate's parent was null.

The resolution traversed Vite's optional devtools peer graph and the
`@vitejs/devtools-vitest@0.8.0 → vitest: "*"` edge. It also considered the unused
optional `@vitest/browser-webdriverio@4.1.11` peer, which requests Vitest 4.1.11.
Those optional plugins are not installed or enabled in this product. The older
full-project log also showed Vitest 5 considered for jest-dom's
broad optional peer. Removing jest-dom from the reproduction did **not** fix it;
jest-dom alone was not the cause. This is a resolver failure, not evidence that
the intended Vitest 4 cohort has incompatible peers. No global npm source was
edited; diagnostic instrumentation lived only in a disposable process.

The same reproduction resolves with the documented root override
`"vitest": "4.1.12"`, matching the exact direct dependency. A `$vitest` reference
also failed in the detached-root path, so the equal literal pin is intentional.
The override constrains resolution to the product's supported test cohort without
selecting Vitest 5 or skipping validation of the installed peer graph. It does not
certify compatibility of every uninstalled optional browser plugin; mixed cohorts
are rejected by the dependency policy. See [npm overrides](https://docs.npmjs.com/cli/v10/configuring-npm/package-json/#overrides).

## Supported minimal changes

- Keep the existing npm 10.9.3 and Node 22.20.0 validation environment.
- Upgrade Vitest and its seven matching helper packages from 4.1.11 to 4.1.12.
- Constrain Vitest resolution to that same direct pin via a supported npm override.
- Scope a second override to `jsdom → undici@7.30.1`; it satisfies jsdom's existing
  `^7.25.0` contract. Merely running targeted update/audit-fix had retained 7.30.0.
- Retain the resolver-selected compatible Chai and tinyrainbow minor updates.
  No production package, model, verifier or candidate implementation was upgraded.
- Install and validate with `--strict-peer-deps`, lifecycle scripts disabled, and
  `npm ls --all`. CI audits both all dependencies and the production-only tree,
  without a severity threshold or advisory suppression.
- Add tested dependency-policy checks that reject the old mocker/Undici versions,
  mixed Vitest cohorts and loss of the peer constraint. Registry audit remains
  necessary because fixed minimum versions cannot detect future advisories.

No `--force`, `--legacy-peer-deps`, manual lockfile fabrication, global package-manager
upgrade, host candidate-code execution or security-boundary relaxation was used.

## Verification and limits

Completed checks cover clean strict installation, full and production audits,
peer-graph validity, formatting/lint/typecheck, complete tests and production build.
The refreshed recorded-browser check passed after the operator started the existing
local preview: desktop/mobile rendering, REPLAY navigation, keyboard activation,
disabled intake, zero axe violations and no console/page errors. No write requests,
model calls or Docker startup occurred. See [validation](VALIDATION.md).
The security trigger
is the registry's vulnerable version finding, plus deterministic rejection of those
versions; no claim is made that every network exploit was independently replayed.

The registry audit does not assess Node's bundled implementation, operating-system
libraries or the frozen Docker image. Runtime/image security review and genuine
fresh-machine isolated live execution remain separate requirements. Keep development
servers loopback-only, do not run untrusted repository tests on the host, and do not
enable live mode without its exact validated isolation prerequisites.

Hosted GitHub/Linux execution subsequently passed at the October 30 cleanup-fix
commit ([run 41023529593](https://github.com/pranjalmax/IntentBench/actions/runs/41023529593)).
The source repository is now public. Separate website-deployment approval and documented
binary/image notice review remain distinct from remediation of npm findings.
