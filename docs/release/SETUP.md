# Portable local setup

Use Node 22.20.0 and npm 10.9.3. From the checkout root:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run product:serve
```

Open <http://127.0.0.1:4317>. Defaults are `INTENTBENCH_MODE=recorded`, loopback
host, port 4317 and an ignored checkout-local `.intentbench-data` directory.
Recorded browsing needs no Docker, authentication, original workspace or model call.
It shows authentic REPLAY, not newly generated verification. No saved live runs or
synthetic successful history are preloaded.

If port 4317 is already occupied, use a separate port. PowerShell:

```powershell
$env:INTENTBENCH_PORT='4320'
npm run product:serve
```

POSIX shell: `INTENTBENCH_PORT=4320 npm run product:serve`.
Open <http://127.0.0.1:4320>. Leave the terminal open; Ctrl+C stops the service.
Host configuration rejects non-loopback addresses. Do not point this edition at
someone else's private saved database.

## Recorded evidence

Six study result tables and six selected full sanitized final trajectories are
available in Research archive. Product acceptance screenshots and portable exports
are in the [evidence index](EVIDENCE.md). The genuine acceptance run shown there
is not present in the fresh checkout's database, and must not be described as a
current live execution. History/source views remain honestly empty until real
live jobs exist in that checkout's configured data root.

## Live verification: explicit opt-in only

PowerShell, only after the operator has provisioned the prerequisites:

```powershell
$env:INTENTBENCH_MODE='live'
$env:INTENTBENCH_AUTH_FILE=Join-Path (Get-Location) '.intentbench-auth/codex-home/auth.json'
npm run product:serve
```

The authentication file is not provided. Use a dedicated isolated home after
explicit authorization; never inspect/copy normal Codex credentials. Missing
authentication configuration prevents live startup; an absent or invalid file
blocks isolation preflight. Merely placing a file in the checkout does
not enable execution. Model use requires the appropriate account/entitlement.

The existing executor requires Codex CLI 0.150.1 and:

```text
intentbench-codex:0.150.1
sha256:e77098ecaea63d73e29b114d18e847aac74379eb686b821046bfc87ec8f67ee4
```

The [reference Dockerfile](../../runtime-image/Dockerfile) and
[entrypoint](../../runtime-image/entrypoint.sh) are included as reviewed source.
No image is shipped or started here. Rebuilding may not reproduce its byte identity;
an unrecognized image must be refused, not assigned a new trusted identity casually.
Fresh-machine image distribution, SBOM/CVE review and live isolation validation
remain disclosed blockers for a turnkey live distribution. Recorded mode and
the source build work independently of them.

Live execution retains frozen `gpt-5.6-sol` high reasoning, workspace-only sandbox,
shell internet denial, narrow mounts and read-only dedicated authentication. The
model client alone retains its service connection. No untrusted candidate command
ever runs on the host. Do not run uploaded test/install scripts in your shell.

## Reproduction and failure states

`npm test` uses synthetic non-benchmark fixtures and mocked model responses.
UNKNOWN is not semantic failure; runtime errors do not become findings. Cancelled
jobs do not invent reports. A missing or wrong image/auth/profile fails closed.
The default recorded upload route returns 503 before receiving/storing a candidate.

Git attributes force LF for frozen profiles and gate byte hashes on all checkouts.
Do not rewrite those files. See [security](SECURITY.md), [architecture](ARCHITECTURE.md)
and [reproduction](REPRODUCTION.md).
