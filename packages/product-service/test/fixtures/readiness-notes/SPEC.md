# Workspace notes summary

Implement the named export `summarizeNotes(records)` in `src/notes.mjs`.

The input is an array of records shaped as `{ id: string, title: string, archived: boolean }`.
IDs are unique and titles contain printable ASCII characters. The caller supplies inputs
of this shape.

The result must be an object with these three fields:

- `activeCount`: the number of records whose `archived` flag is false.
- `archivedCount`: the number of records whose `archived` flag is true.
- `notes`: one `{ id, title }` object for each active record. Trim leading and trailing
  whitespace from each title. Sort by trimmed title using case-sensitive ASCII order;
  break equal-title ties by ID using the same order. Archived notes must not appear.

Do not modify the input array or its records. Every returned note must be a new object;
editing a returned title must not change the corresponding input record.

An empty input produces zero counts and an empty notes array. The function is synchronous
and has no filesystem, network, clock or process side effects.

Run the provided tests with `npm test`. No dependency installation is needed.
