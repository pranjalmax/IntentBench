# IntentBench report

- Verdict: **COMPLETE**
- Run: `run_8bfa56d7c07f47d4be2f88aa56e20e68`
- Snapshot: `sha256:790be69176279cfe5859aa8bb7cd974bacbaec667a75a6b51e8ac52882dd31d9`
- Generated: 2026-10-19T07:13:05.231Z
- Verifier: A1.1

## Requirement ledger

### R1 — REQUIRED

src/notes.mjs must provide the named export summarizeNotes(records).

Success condition: An ES module import of the named summarizeNotes export from src/notes.mjs succeeds and yields a function.

### R2 — REQUIRED

The result must be an object with the fields activeCount, archivedCount, and notes.

Success condition: Calling summarizeNotes with contract-valid input returns an object containing the three specified fields.

### R3 — REQUIRED

activeCount must equal the number of records whose archived flag is false.

Success condition: For contract-valid input, activeCount equals the count of records with archived === false.

### R4 — REQUIRED

archivedCount must equal the number of records whose archived flag is true.

Success condition: For contract-valid input, archivedCount equals the count of records with archived === true.

### R5 — REQUIRED

notes must contain one { id, title } object for each active record.

Success condition: Each record with archived === false contributes exactly one note containing its id and processed title.

### R6 — REQUIRED

Each returned note title must have leading and trailing whitespace trimmed.

Success condition: Returned titles omit the leading and trailing whitespace present in their corresponding input titles.

### R7 — REQUIRED

Returned notes must be sorted by trimmed title using case-sensitive ASCII order.

Success condition: For printable-ASCII titles, notes appear in ascending case-sensitive ASCII order of their trimmed titles.

### R8 — REQUIRED

Equal trimmed-title ties must be broken by ID using the same case-sensitive ASCII order.

Success condition: Notes with equal trimmed titles appear in ascending case-sensitive ASCII order of id.

### R9 — REQUIRED

Archived notes must not appear in notes.

Success condition: No input record with archived === true contributes an object to the returned notes array.

### R10 — REQUIRED

The input array must not be modified.

Success condition: The input array retains its elements, order, and length after the call.

### R11 — REQUIRED

Input records must not be modified.

Success condition: Every input record retains its original id, title, and archived values after the call.

### R12 — REQUIRED

Every returned note must be a new object.

Success condition: No returned note is object-identical to an input record.

### R13 — REQUIRED

Editing a returned title must not change the corresponding input record.

Success condition: Assigning a new value to a returned note's title leaves the source record's title unchanged.

### R14 — REQUIRED

An empty input must produce zero active and archived counts and an empty notes array.

Success condition: summarizeNotes([]) returns { activeCount: 0, archivedCount: 0, notes: [] }.

### R15 — REQUIRED

The function must be synchronous.

Success condition: The call directly returns the result object rather than a Promise or deferred result.

### R16 — REQUIRED

The function must have no filesystem side effects.

Success condition: The implementation performs no filesystem access or mutation.

### R17 — REQUIRED

The function must have no network side effects.

Success condition: The implementation performs no network access.

### R18 — REQUIRED

The function must have no clock side effects.

Success condition: The implementation does not read, write, or otherwise interact with clock facilities.

### R19 — REQUIRED

The function must have no process side effects.

Success condition: The implementation does not interact with or mutate process state.

### R20 — REQUIRED

The provided tests must be run with npm test.

Success condition: Running npm test invokes and successfully completes the provided test suite.

## Evidence

### E1 — SUPPORTS

Requirements: R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11, R12, R13, R14, R15

Reproduction: Run `sed -n '1,240p' src/notes.mjs` from /workspace and inspect the complete function.

Observed: The module declares `export function summarizeNotes(records)`. It filters with `!record.archived`, maps each active record to a fresh `{ id: record.id, title: record.title.trim() }` object, sorts the derived array with direct string `&lt;` and `&gt;` comparison by title and then id, and synchronously returns `{ activeCount: notes.length, archivedCount: records.length - notes.length, notes }`. Sorting occurs after map on the derived array, not on records. With the documented boolean archived flags, the two count expressions count false and true flags respectively. The same direct pipeline yields zero counts and an empty notes array for empty input.

### E2 — SUPPORTS

Requirements: R1, R2, R3, R4, R5, R6, R8, R9, R10, R11, R12, R13, R14

Reproduction: Inspect tests/notes.test.mjs, then run `npm test` from /workspace.

Observed: The visible tests import the named export and assert mixed-input counts, title trimming, active-note filtering, title ordering, equal-title ID ordering, frozen-input compatibility, returned-object independence, empty input, and entirely archived input. The command exited 0 with 1 test file passing, 0 failures, and 0 skipped tests.

### E3 — SUPPORTS

Requirements: R2, R3, R4, R5, R6, R7, R8, R9, R10, R11, R12, R13, R15

Reproduction: Run `node --input-type=module` from /workspace, import summarizeNotes, and call it with `[{id:'b',title:' x ',archived:false},{id:'a',title:'x',archived:false},{id:'D',title:'apple',archived:false},{id:'C',title:'Apple',archived:false},{id:'e',title:' archived ',archived:true}]`; snapshot the result, compare serialized input before and after, check returned/input identities, verify the result is not a Promise, mutate result.notes[0].title, and observe records[3].title.

Observed: Before result mutation, the output was `{activeCount:4,archivedCount:1,notes:[{id:'C',title:'Apple'},{id:'D',title:'apple'},{id:'a',title:'x'},{id:'b',title:'x'}]}`. The archived record was absent, uppercase `Apple` preceded lowercase `apple`, and equal `x` titles were ordered by IDs `a` then `b`. The serialized input remained unchanged, every returned note had a new identity, editing the first returned title left its input title as `Apple`, and the result was not a Promise.

### E4 — SUPPORTS

Requirements: R16, R17, R18, R19

Reproduction: Run `sed -n '1,240p' src/notes.mjs` and inspect the complete module for imports and external API access.

Observed: The complete module contains no imports and only defines a local comparator, performs Array filter/map/sort operations, trims strings, calculates counts, and constructs a return object. It contains no filesystem, network, clock, timer, or process access.

### E5 — SUPPORTS

Requirements: R20

Reproduction: Run `sed -n '1,200p' package.json` from /workspace.

Observed: package.json defines the test script as `node --test tests/notes.test.mjs` and declares no dependencies requiring installation.

### E6 — SUPPORTS

Requirements: R20

Reproduction: Run `npm test` from /workspace with the repository as provided.

Observed: npm invoked `node --test tests/notes.test.mjs`; the test run completed successfully with exit code 0, 1 passing test file, and no failures, cancellations, skips, or todos.

## Blocking findings

None.

## Advisories

None.
