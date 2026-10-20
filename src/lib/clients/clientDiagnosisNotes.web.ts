export type ClientDiagnosisNoteEntryWeb = Readonly<{
  ordinal: number;
  noteState: 'value' | 'empty';
  note: string | null;
  sourceState: 'not_supplied';
  recordedAtState: 'not_supplied';
  clinicalState: 'not_confirmed';
}>;

export type ClientDiagnosisNotesProjectionWeb = Readonly<{
  kind: 'client_diagnosis_notes_projection';
  authority: 'inspection_only';
  state: 'unavailable' | 'unknown' | 'present';
  entries: readonly ClientDiagnosisNoteEntryWeb[];
}>;

export function projectClientDiagnosisNotesWeb(input: unknown): ClientDiagnosisNotesProjectionWeb {
  if (input === null) {
    return Object.freeze({
      kind: 'client_diagnosis_notes_projection' as const,
      authority: 'inspection_only' as const,
      state: 'unavailable' as const,
      entries: Object.freeze([]),
    });
  }
  if (!Array.isArray(input) || !input.every((value) => typeof value === 'string')) {
    throw Error('Der gelieferte Diagnosenbestand ist nicht bestätigt.');
  }
  const entries = Object.freeze(input.map((value, index) => Object.freeze({
    ordinal: index + 1,
    noteState: value.length > 0 ? 'value' as const : 'empty' as const,
    note: value.length > 0 ? value : null,
    sourceState: 'not_supplied' as const,
    recordedAtState: 'not_supplied' as const,
    clinicalState: 'not_confirmed' as const,
  })));
  return Object.freeze({
    kind: 'client_diagnosis_notes_projection' as const,
    authority: 'inspection_only' as const,
    state: entries.length > 0 ? 'present' as const : 'unknown' as const,
    entries,
  });
}
