# Public edition validation

Checks validated on Windows with Node 22.20.0 and npm 10.9.3 on October 29, 2026.
Package checks used a separate disposable clone with no hardlinks and a fresh
install. Browser checks used the operator-started public edition at loopback port
4335 in recorded-only mode; the canonical private workspace was not used.

| Check                                                             | Result                                                                                        |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `npm ci --ignore-scripts --strict-peer-deps --no-audit --no-fund` | PASS, dedicated cache; lifecycle scripts disabled                                             |
| Formatting, lint, typecheck                                       | PASS                                                                                          |
| Complete tests                                                    | PASS: 102 Vitest tests and 10 Node audit tests                                                |
| Production TypeScript/Vite build                                  | PASS, no oracle compilation                                                                   |
| Explicit public-file/hash/privacy audit                           | PASS: no credential/personal-path pattern findings                                            |
| Frozen A1.1 prompt/config/gate bytes                              | Match all three retained identities                                                           |
| Local authored documentation links                                | PASS: 83 file targets resolve                                                                 |
| Registry dependency audit                                         | Zero findings after Vitest/mocker 4.1.12 and jsdom/Undici 7.30.1 updates                      |
| Recorded browser journey, 1440px and 390px                        | PASS: authentic REPLAY selection, 12 candidate rows, keyboard navigation and disabled uploads |
| Accessibility / browser errors                                    | Zero axe WCAG A/AA violations, console/page errors or page overflow in the checked states     |

The October 29 follow-up closes the earlier preview-launch blocker. The operator
started the existing public service; no alternate process-launch route was used.
The existing `test:browser` command passed at widths 1440 and 390. Additional Chrome
checks and visually inspected screenshots cover 1440×1000 and 390×844, including
page identity, no framework overlay, recorded trajectory selection, Enter-key
navigation to disabled intake and back, and no console warnings/errors.
The API reported `liveVerificationEnabled: false`; there were no write requests,
model calls or Docker startup. Browser plugin was unavailable, so existing Playwright
and installed Chrome were used. No screenshot or activity was fabricated.

Browser validation initially exposed an accessibility-harness context setup error
and a missing exported favicon. Both were corrected in this public edition.
The regression check now creates an explicit browser context, checks the icon
response and fails on console errors. No frozen verifier artifact was changed.

The public checkout does not contain the private saved acceptance database. Its
screenshots and exports are authentic recorded evidence, not a freshly executed
verification or populated run history. No Docker startup, credential access,
semantic oracle execution or model request was used for these checks.

## Unverified / approval limits

- GitHub-hosted CI and non-Windows local execution have not been run. The minimal
  CI workflow is prepared, not claimed green on GitHub.
- Live mode was not rerun. Fresh-machine provisioning of the exact pinned image,
  container SBOM/CVE/notice review and isolated live validation remain outstanding.
  There is no host-execution or arbitrary-image fallback.
- Dependency license metadata is complete, but optional-platform and nine absent
  top-level notice files need review before bundled binary/image redistribution.
- Automated scanning and visual screenshot inspection cannot prove the absence
  of all possible sensitive information. Ignored credential stores were excluded
  opaquely and never opened for this audit.
- Owner license/copyright/evidence-rights approval and separate publication approval
  are still required. No project LICENSE has been applied.

Both historical final scores remain **V0 8/12 and A1.1 8/12**. No experimental
trajectory, benchmark, gate, prompt or result was tuned or rerun.
