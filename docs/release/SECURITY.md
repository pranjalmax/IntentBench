# Public edition security boundary

Local single-user tool, not a public multi-tenant execution service. Default
recorded mode has no authentication prerequisite and cannot accept live uploads.
The API rejects them before intake; the UI has no upload form in that mode.

## Live opt-in does not relax isolation

Live mode requires explicit configuration and dedicated authentication. It keeps
the original pinned image/profile, bounded ZIP intake, immutable snapshots, sanitized
events and deterministic gate. Candidate commands execute only in the existing
Docker/Codex sandbox; no host-execution fallback exists.

The validated container has a read-only root, dropped capabilities, bounded tmpfs,
PID limits and no-new-privileges. It uses bridge networking and `seccomp=unconfined`;
it is not a networkless container or Firecracker VM. The Linux Codex permissions
deny shell internet and filesystem access beyond the workspace. The model client
still needs its service connection. Narrow mounts exclude host home, Docker socket,
private benchmark data and normal/global Codex configuration. Dedicated authentication
is mounted read-only. No code claims immunity to native-code/kernel/runtime exploits.

Global skills/plugins/MCP/memory/browser/subagents remain disabled/unavailable.
Original candidate snapshots are immutable; disposable working copies permit
targeted checks while the protocol forbids implementation edits. Prompt injection
and model reasoning mistakes remain risks; schema validation is not a complete defense.

## Intake and local API

ZIP limits remain 10 MiB compressed, 25 MiB expanded, 5 MiB per file, 2,000 entries
and depth 24. Reject traversal, absolute/UNC/drive/ADS/reserved names, collisions,
links/special entries and likely secret files. Source preview is inventory-only,
hash-verified inert text, bounded to 256 KiB and 500-line pages. Candidate hashes
are byte-exact; reviewed research text alone canonicalizes CRLF to LF.

Loopback and Host/Origin checks remain mandatory in both modes. There is no
multi-tenant account system, public-service quota scheme or public deployment.
COMPLETE is not proof of correctness. UNKNOWN, semantic INCOMPLETE, infrastructure
failure and cancellation remain distinct.

## Export/privacy and credentials

Only explicit reviewed source/evidence files are included. No sealed tasks/oracles,
raw truth/overlays, authentication, private database, original Git objects, internal
logs/plans or unreviewed trajectories are included. Published historical classification
labels remain in the reviewed result tables; no sealed oracle source is exposed.

Never copy normal Codex credentials. Any fresh isolated login needs separate
authorization. The source tree ignores dedicated authentication, local data, keys,
environment secrets and dependencies. Check uploads for secrets before intake;
filename/pattern controls are not universal DLP. Local user reports can contain
private source and should not be committed or published.

The public audit checks every allowlisted file, credential/personal-path patterns,
forbidden file classes, copied evidence and frozen byte identities. Source maps
and build/data directories are excluded from Git. Pattern scanning/OCR is not an
absolute privacy guarantee; screenshots were visually reviewed. Upstream legal
copyright notices are not private user paths and remain intact.

## Before any publication or live-image distribution

### Static portfolio release exception

The proposed manually triggered Pages workflow publishes only audited
`dist/replay/` files, without a server, upload receiver, authentication or model
calls. An explicit [scoped release policy](STATIC-RELEASE-POLICY.md) accepts the
currently unpatched, development-only picomatch advisory for a trusted-main
static build. This is not a resolved vulnerability. The full npm audit stays
active and visibly failing. New advisories, production findings, audit errors,
failed tests, browser checks, privacy or artifact verification block publication.
It does not authorize deploying the local API or changing live isolation.

Approve [project licensing](../../LICENSE-DECISION.md), rights to reviewed evidence,
and final source/export policy. Resolve the [audit blockers](AUDIT.md). The reference
image recipe alone does not establish the pinned image ID, a complete image SBOM,
CVE clearance or fresh live-isolation proof. Do not bypass those gaps.
