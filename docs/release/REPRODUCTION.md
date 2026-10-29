# No-credit reproduction

From a fresh checkout with Node 22.20.0/npm 10.9.3:

```sh
npm ci --ignore-scripts --strict-peer-deps --no-audit --no-fund
npm run format:check
npm run lint
npm run typecheck
npm test
npm run product:build
npm run audit:public
npm ls --all
npm audit
npm audit --omit=dev
```

These commands do not require Docker or authentication and make no model request.
There is no oracle compilation, sealed task catalog or experiment launcher in the
export. Product tests use new synthetic fixtures and mocked model responses; the
existing filesystem/gate tests exercise actual deterministic behavior.

Start `npm run product:serve` and browse Research archive, explicitly REPLAY.
For an installed Chrome browser, `npm run test:browser` uses
`INTENTBENCH_WEB_URL` (default loopback port 4320); launch the service on that port
as described in [setup](SETUP.md). It reads authentic research, checks mode/disabled
intake and desktop/mobile accessibility; it never launches a review.

## Authoritative reviewed evidence

- [Final result](../../research/results/final-holdout-evaluation.json)
- [Original published report](../../research/FINAL-REPORT.md)
- [Locked protocol](../../research/protocol.json)
- [Both-arm freeze](../../research/phase-a-freeze.json)
- [A1.1 pre-evaluation identity](../../advanced-verifier/freeze.json)
- [Public research allowlist](../../packages/product-service/research-manifest.json)

Twelve one-time candidate archives were identical across arms. V0 froze, then A1.1,
then deterministic truth was revealed once. This source export contains published
results, not the sealed candidate set/oracle or a mechanism to rerun the research.
All scores and selected trajectory bytes remain unchanged.

## Safe CI

The [workflow](../../.github/workflows/ci.yml) runs the same ordinary source gates
on an ephemeral Linux runner with read-only repository permissions, SHA-pinned
actions and persisted checkout credentials disabled. No secrets, model calls,
Docker jobs, deployment, publication or artifact upload is configured. npm lifecycle
scripts are disabled during dependency installation.

It has not been executed on GitHub because publication is not authorized. Local
fresh-clone results and remaining limits are recorded in the [audit](AUDIT.md).
