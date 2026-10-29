# Public edition validation

Validated on Windows with Node 22.20.0, npm 10.9.3 and installed Chrome on
October 21, 2026. A separate local clone with no hardlinks and a fresh install
was used; the original private workspace was not the execution root.

| Check                                          | Result                                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `npm ci --ignore-scripts --no-audit --no-fund` | PASS, dedicated clean cache                                                                       |
| Formatting, lint, typecheck                    | PASS                                                                                              |
| Complete tests                                 | PASS: 102 Vitest tests across 24 files, plus 5 Node audit tests                                   |
| Production TypeScript/Vite build               | PASS, no oracle compilation                                                                       |
| Explicit public-file/hash/privacy audit        | PASS: no credential/personal-path pattern findings                                                |
| Frozen A1.1 prompt/config/gate bytes           | Match all three retained identities                                                               |
| Local authored documentation links             | PASS: 78 file targets resolve                                                                     |
| Registry dependency audit                      | Zero known vulnerabilities after two compatible development-only patches                          |
| Recorded browser journey, 1440px and 390px     | PASS: 12 historical candidate rows, authentic selected REPLAY, disabled uploads                   |
| Accessibility / browser errors                 | Zero axe WCAG A/AA violations, page errors, console errors or page overflow in the checked states |

Browser validation initially exposed an accessibility-harness context setup error
and a missing exported favicon. Both were corrected in this public edition.
The regression check now creates an explicit browser context, checks the icon
response and fails on console errors. No frozen verifier artifact was changed.

The public checkout does not contain the private saved acceptance database. Its
screenshots and exports are authentic recorded evidence, not a freshly executed
verification or populated run history. No Docker startup, credential access,
semantic oracle execution or model request was used for these checks.

## Unverified / approval limits

- The October 29 registry refresh supersedes the October 21 dependency-audit row:
  three development-package entries are currently affected (one high, two moderate).
  Supported patch resolution was blocked by an npm peer-graph error. The validated
  dependency tree is unchanged; see the [current audit](AUDIT.md). Publication is
  blocked pending remediation and a fresh install/test/build check.

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
