# Static REPLAY edition

Target: `https://pranjalmax.github.io/IntentBench/`. This feature prepares the site;
it does not enable Pages, merge a PR, dispatch deployment or publish a website.

Actual preview captures: [desktop](assets/replay-desktop.png) · [mobile](assets/replay-mobile.png).

## Two independent build targets

- `npm run product:build` and `npm run product:serve`: the existing local product,
  with its unchanged loopback API and explicit live-isolation prerequisites.
- `npm run replay:build`: Vite replay mode at `/IntentBench/`, output `dist/replay/`.
  A compile-time edition boundary routes read-only research requests through the
  static adapter and rejects writes/unsupported routes before any network call.
  There is no fallback to `/v1`, localhost or an external model service.
- `npm run replay:preview`: local static preview on port 4336. This is a development
  preview, not a public production server.

The build reuses `ResearchArchive` and `readVerifiedFile` to check the original
public manifests. It generates six study JSON files, six complete sanitized trace
JSON files, the genuine acceptance JSON/Markdown and a derived manifest. No oracle,
candidate code, private database, authentication or model runner is copied. Historical
artifacts remain byte-identical. Browser reads validate SHA-256 before showing data.

The frontend preserves the existing design, research comparisons, trace pagination,
requirement index, proof/evidence navigation, URL deep links and authentic report
downloads. The acceptance report is historical REPLAY, not a newly successful job.
Source inspection and local run history have explicit unavailable states; they are
not reconstructed from screenshots or replaced with fabricated data. Demo details
describe static capabilities rather than pretending to run an isolation preflight.

## Validation

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run product:build
npm run replay:build
npm run audit:replay
npm run test:replay-browser
npm run audit:public
npm audit
npm audit --omit=dev
```

The browser gate starts a temporary loopback **static-file-only** server and
installed Chrome. It tests 1440px desktop and 390px mobile, keyboard requirement
selection, comparisons, trace pagination, refreshed deep links, both authentic
downloads, unavailable functionality, WCAG A/AA checks, overflow, console health
and tamper rejection. Every request must be same-origin under `/IntentBench/` and
GET/HEAD. `/v1` requests, writes and external requests fail the gate. Screenshots
are written outside the repository for inspection. There are no model calls.

Unit/integration tests also reject changed original acceptance evidence, changed
downloaded data, unsafe asset paths, unsupported routes and all hosted mutations.
The existing local API, executor and UI regression tests remain part of the suite.
The artifact audit checks every generated file against the static layout, rejects
links/unexpected file classes, scans text for credential/personal-path patterns,
verifies generated data hashes and matches exports to their original evidence pins.

## Deployment boundary after separate approval

Enable GitHub Pages only after review. Publish **only** `dist/replay/` through a
separate reviewed Pages workflow. Do not publish the parent `dist/` directory:
it also contains the compiled local service. Do not enable serverless functions,
live uploads, proxy routes, environment credentials or model connections.

The present CI only builds and tests. It has no Pages deployment action or
`pages: write`/`id-token: write` permissions. A content security policy restricts
scripts, styles, fonts and data connections to self and disallows form submission,
objects and external base URLs. No arbitrary historical command is executed.

The MIT license and third-party font notices apply. The static website remains a
portfolio REPLAY, not a public verification SaaS. Research limitations stay visible:
V0 and A1.1 both scored 8/12 on the final holdout; no final accuracy gain is claimed.
