# Public edition validation

Non-browser checks validated on Windows with Node 22.20.0 and npm 10.9.3 on
October 29, 2026. A separate disposable clone with no hardlinks and a fresh install
was used; the original private workspace was not the execution root.

| Check                                                             | Result                                                                                                        |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `npm ci --ignore-scripts --strict-peer-deps --no-audit --no-fund` | PASS, dedicated cache; lifecycle scripts disabled                                                             |
| Formatting, lint, typecheck                                       | PASS                                                                                                          |
| Complete tests                                                    | PASS: 102 Vitest tests and 10 Node audit tests                                                                |
| Production TypeScript/Vite build                                  | PASS, no oracle compilation                                                                                   |
| Explicit public-file/hash/privacy audit                           | PASS: no credential/personal-path pattern findings                                                            |
| Frozen A1.1 prompt/config/gate bytes                              | Match all three retained identities                                                                           |
| Local authored documentation links                                | PASS: 83 file targets resolve                                                                                 |
| Registry dependency audit                                         | Zero findings after Vitest/mocker 4.1.12 and jsdom/Undici 7.30.1 updates                                      |
| Recorded browser journey, 1440px and 390px                        | BLOCKED: execution policy rejected launching the local preview; awaiting an operator-started recorded preview |
| Accessibility / browser errors                                    | Not revalidated for this dependency update; October 21 results below are historical only                      |

The October 21 browser validation passed at 1440px/390px with zero axe A/AA,
console/page-error or page-overflow findings. That prior check is not a new browser
pass for this dependency change. No screenshot or activity was fabricated.

Browser validation initially exposed an accessibility-harness context setup error
and a missing exported favicon. Both were corrected in this public edition.
The regression check now creates an explicit browser context, checks the icon
response and fails on console errors. No frozen verifier artifact was changed.

The public checkout does not contain the private saved acceptance database. Its
screenshots and exports are authentic recorded evidence, not a freshly executed
verification or populated run history. No Docker startup, credential access,
semantic oracle execution or model request was used for these checks.

## Unverified / approval limits

- The new local preview launch was rejected by the tool execution policy; no
  alternate process-launch route was used. Browser checks require an operator-started
  recorded-only preview. The npm findings are remediated, but full validation remains
  incomplete until that check is performed.

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
