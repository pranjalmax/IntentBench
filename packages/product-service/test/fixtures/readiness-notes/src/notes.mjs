export function summarizeNotes(records) {
  const compare = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
  const notes = records
    .filter((record) => !record.archived)
    .map((record) => ({ id: record.id, title: record.title.trim() }))
    .sort((left, right) => compare(left.title, right.title) || compare(left.id, right.id));
  return {
    activeCount: notes.length,
    archivedCount: records.length - notes.length,
    notes,
  };
}
