# Project license: approval required

No project LICENSE has been applied. `private: true` and `license: UNLICENSED` prevent
accidental package publication and make the pending status explicit; they do not
select an open-source license. Do not publish until the owner approves a license
and confirms authority over code, documentation, screenshots and selected outputs.

## Proposed choices (not applied)

| Choice     | Decision to approve                                                                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MIT        | Concise permissive licensing, preserving its copyright/permission notice. Proposed default if straightforward reuse is the goal.                           |
| Apache-2.0 | Permissive licensing with an explicit contributor patent grant/termination and more redistribution/notice provisions. Choose if those terms are preferred. |
| Defer      | Keep the candidate private/unpublished until rights and terms are settled.                                                                                 |

Primary texts: [MIT at OSI](https://opensource.org/license/mit) and
[Apache 2.0 at ASF](https://www.apache.org/licenses/LICENSE-2.0).
This comparison is not legal advice. Approval must name the copyright owner/entity;
do not assume the neutral local Git export identity is the copyright holder.

## Third-party boundaries

[Dependency inventory](third-party/licenses.json) covers 266 locked package locations,
including optional platforms. All have declared license metadata. [Upstream notices](third-party/NOTICES.md)
are retained separately and do not license IntentBench itself.

MPL-2.0 appears in development tools (axe and Lightning CSS), not authored product
code. Fontsource's Manrope and Source Serif 4 use OFL-1.1. Those upstream terms
remain separate from any project license; do not relabel dependencies or fonts.
See [Mozilla's MPL FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/) and the
[official OFL site](https://openfontlicense.org/).

The inventory was collected on Windows: 216 installed package locations have
available files; 50 optional platform packages are represented by lockfile metadata.
Nine installed packages lack top-level notice files, disclosed in the audit report.
No node_modules, compiled dependency binaries or Docker image are distributed in
this source export. Bundled binary/image distribution would require a separate
upstream-notice/source-availability and image SBOM review.

Also confirm the right to publish sanitized model outputs/screenshots under the
chosen terms. Model-service account terms and entitlements are independent of the
source license. Publication, GitHub repository creation and deployment are not
authorized by preparing this candidate.
