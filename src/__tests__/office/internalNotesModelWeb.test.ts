import { describe, expect, it } from 'vitest';
import { createNoteDraft } from '@/lib/office/notes/model.web';
import { buildInternalNoteDraft, INTERNAL_NOTE_HANDWRITING_NOTICE, validateInternalNoteDraft } from '@/lib/office/notes/internalModel.web';
const EMPLOYEE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const valid = () => ({ ...buildInternalNoteDraft(), title: 'Rückruf', body: 'Bitte heute zurückrufen.', recipientEmployeeIds: [EMPLOYEE] });

describe('explicit internal note copy', () => {
  it('copies only visible text and selected-format content, never source identifiers or hidden formats', () => {
    const note = { ...createNoteDraft(), id: 'PRIVATE-ID', ownerUserId: 'PRIVATE-OWNER', tags: ['PRIVATE-TAG'], title: 'Übergabe', dueDate: '2026-10-22' };
    note.content.text = 'Sichtbarer Text'; note.content.cues = 'HIDDEN-CUES'; note.content.summary = 'HIDDEN-SUMMARY';
    note.content.nodes = [{ id: 'NODE-ID', parentId: null, text: 'HIDDEN-NODE', x: 11, y: 22 }];
    note.content.strokes = [{ id: 'STROKE-ID', color: '#000', width: 3, points: [[8, 9]] }];
    note.content.fields = [{ id: 'FIELD-ID', label: 'Telefon', value: '12345' }];
    note.content.tasks = [{ id: 'TASK-ID', text: 'Rückruf', status: 'in_progress', assignee: 'Alex', dueDate: '2026-10-22' }];
    note.content.sources = [{ id: 'SOURCE-ID', title: 'Kontakt', url: 'https://example.invalid' }];
    const before = JSON.stringify(note), copy = buildInternalNoteDraft(note), encoded = JSON.stringify(copy);
    expect(copy).toMatchObject({ title: 'Übergabe', dueDate: '2026-10-22', recipientEmployeeIds: [] });
    for (const visible of ['Sichtbarer Text', 'Telefon: 12345', 'Rückruf', 'In Bearbeitung', 'Alex', 'https://example.invalid']) expect(copy.body).toContain(visible);
    for (const privateValue of ['PRIVATE', 'HIDDEN', 'NODE-ID', 'FIELD-ID', 'TASK-ID', 'SOURCE-ID', 'STROKE-ID']) expect(encoded).not.toContain(privateValue);
    expect(JSON.stringify(note)).toBe(before);
    expect(buildInternalNoteDraft({ ...note, format: 'cornell' }).body).toContain('HIDDEN-CUES');
    expect(buildInternalNoteDraft({ ...note, format: 'cornell' }).body).not.toContain('HIDDEN-NODE');
    expect(buildInternalNoteDraft({ ...note, format: 'mindmap' }).body).toContain('HIDDEN-NODE');
    expect(buildInternalNoteDraft({ ...note, format: 'mindmap' }).body).not.toContain('HIDDEN-SUMMARY');
  });
  it('keeps handwriting out, provides an explicit warning and never silently truncates the reviewed text', () => {
    const note = createNoteDraft('handwriting'); note.content.text = 'A'.repeat(20001);
    expect(buildInternalNoteDraft(note).body).toHaveLength(20001);
    expect(INTERNAL_NOTE_HANDWRITING_NOTICE).toContain('nicht mitgesendet');
    expect(validateInternalNoteDraft({ ...valid(), body: buildInternalNoteDraft(note).body })).toContain('20.000');
    expect(buildInternalNoteDraft({ ...note, category: 'tasks' }).kind).toBe('task');
    expect(buildInternalNoteDraft({ ...note, category: 'next_steps' }).kind).toBe('task');
  });
  it('requires a reviewed title, text, valid kind/priority and 1–25 distinct employees', () => {
    expect(validateInternalNoteDraft(valid())).toBeNull();
    for (const value of [null, {}, { ...valid(), title: ' ' }, { ...valid(), title: 'a'.repeat(241) }, { ...valid(), body: ' ' }, { ...valid(), kind: 'secret' }, { ...valid(), priority: 'urgent' }, { ...valid(), recipientEmployeeIds: [] }, { ...valid(), recipientEmployeeIds: [EMPLOYEE, EMPLOYEE.toUpperCase()] }, { ...valid(), recipientEmployeeIds: [null] }, { ...valid(), recipientEmployeeIds: Array(26).fill(EMPLOYEE) }]) expect(validateInternalNoteDraft(value)).not.toBeNull();
  });
  it('checks real calendar dates without converting them through the browser timezone', () => {
    for (const dueDate of ['', '2028-02-29', '2026-10-18']) expect(validateInternalNoteDraft({ ...valid(), dueDate })).toBeNull();
    for (const dueDate of ['2026-02-29', '2026-04-31', '0000-01-01', '2026-13-01', '18.10.2026', null]) expect(validateInternalNoteDraft({ ...valid(), dueDate })).not.toBeNull();
  });
});
