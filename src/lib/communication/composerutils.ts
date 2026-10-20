/** Fügt Text an der aktuellen Cursor-Position ein. */
export function insertTextAtSelection(
  text: string,
  insertValue: string,
  selection: { start: number; end: number },
): { text: string; selection: { start: number; end: number } } {
  const start = Math.max(0, Math.min(selection.start, text.length));
  const end = Math.max(start, Math.min(selection.end, text.length));
  const nextText = `${text.slice(0, start)}${insertValue}${text.slice(end)}`;
  const cursor = start + insertValue.length;
  return { text: nextText, selection: { start: cursor, end: cursor } };
}

export function formatVoiceDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
