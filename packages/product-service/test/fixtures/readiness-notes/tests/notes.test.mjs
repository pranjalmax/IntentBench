import assert from "node:assert/strict";
import test from "node:test";
import { summarizeNotes } from "../src/notes.mjs";

test("counts, trims, filters and sorts active notes", () => {
  const result = summarizeNotes([
    { id: "z", title: " Beta ", archived: false },
    { id: "c", title: "Alpha", archived: false },
    { id: "b", title: " Alpha ", archived: false },
    { id: "a", title: "Hidden", archived: true },
  ]);
  assert.deepEqual(result, {
    activeCount: 3,
    archivedCount: 1,
    notes: [
      { id: "b", title: "Alpha" },
      { id: "c", title: "Alpha" },
      { id: "z", title: "Beta" },
    ],
  });
});

test("accepts frozen inputs and returns independent notes", () => {
  const note = Object.freeze({ id: "a", title: "  Draft  ", archived: false });
  const input = Object.freeze([note]);
  const result = summarizeNotes(input);
  assert.notEqual(result.notes[0], note);
  result.notes[0].title = "Edited";
  assert.equal(note.title, "  Draft  ");
  assert.equal(input.length, 1);
});

test("supports empty and entirely archived inputs", () => {
  assert.deepEqual(summarizeNotes([]), { activeCount: 0, archivedCount: 0, notes: [] });
  assert.deepEqual(summarizeNotes([{ id: "a", title: "Old", archived: true }]), {
    activeCount: 0,
    archivedCount: 1,
    notes: [],
  });
});
