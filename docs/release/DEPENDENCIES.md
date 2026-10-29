# Dependency remediation — October 29, 2026

Scope: the public-source edition only. Frozen benchmarks, verifier profile/gate,
experimental trajectories and measured results were not changed or rerun.

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

Hosted GitHub/Linux execution is not claimed: no remote, push or publication was
authorized. Separate publication approval and documented binary/image notice review remain
separate from remediation of these npm package findings.
