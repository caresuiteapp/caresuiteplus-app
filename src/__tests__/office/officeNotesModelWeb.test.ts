import { describe, expect, it } from 'vitest';
import { createNoteDraft, draftsEqual, newNoteId, NOTE_CATEGORIES, NOTE_FORMATS, NOTE_TEMPLATES, notePreview, noteSearchText, noteToDraft, validateNoteDraft } from '@/lib/office/notes/model.web';
import type { NoteDraft, OfficeNote } from '@/lib/office/notes/types.web';

const fullDraft = (): NoteDraft => ({ ...createNoteDraft(), title: 'Übergabe', tags: ['Straße'], dueDate: '2028-02-29', content: {
  text: 'Gespräch\nvorbereiten', cues: 'Frage', summary: 'Zusammenfassung',
  fields: [{ id: 'f', label: 'Kontakt', value: 'Änne' }],
  tasks: [{ id: 't', text: 'Rückruf', assignee: 'Özlem', status: 'in_progress', dueDate: '2026-12-01' }],
  sources: [{ id: 's', title: 'Quelle', url: 'https://example.com/info' }],
  nodes: [{ id: 'a', parentId: null, text: 'Thema', x: 0, y: 600 }, { id: 'b', parentId: 'a', text: 'Detail', x: 1000, y: 0 }],
  strokes: [{ id: 'p', color: '#2A5', width: 20, points: [[0, 0], [1000, 600]] }],
} });

describe('personal Office note model', () => {
  it('provides all categories and formats with valid empty templates and distinct nested IDs', () => {
    expect(NOTE_CATEGORIES).toHaveLength(11);
    expect(NOTE_FORMATS.map(item => item.value)).toEqual(['plain', 'cornell', 'mindmap', 'handwriting']);
    for (const template of NOTE_TEMPLATES) {
      const draft = createNoteDraft(template.id);
      expect(validateNoteDraft(draft)).toBeNull();
      expect(draft.title).toBe('');
      expect(draft.category).toBe(template.category);
      expect(draft.format).toBe(template.format);
      expect(draft.content.fields.every(field => field.value === '')).toBe(true);
    }
    expect(createNoteDraft('unknown')).toEqual(createNoteDraft());
    expect(createNoteDraft('contact').content.fields[0].id).not.toBe(createNoteDraft('contact').content.fields[0].id);
    expect(newNoteId()).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
  });

  it('accepts actual dates, all structured fields, edge coordinates and empty titles', () => {
    expect(validateNoteDraft(fullDraft())).toBeNull();
    expect(validateNoteDraft(createNoteDraft())).toBeNull();
  });

  it.each(['2026-02-29', '2026-04-31', '0000-01-01', '2026-13-01', '17.10.2026'])('rejects invalid note and task dates: %s', date => {
    const draft = fullDraft(); draft.dueDate = date;
    expect(validateNoteDraft(draft)).not.toBeNull();
    draft.dueDate = ''; draft.content.tasks[0].dueDate = date;
    expect(validateNoteDraft(draft)).not.toBeNull();
  });

  it.each(['javascript:alert(1)', 'data:text/html,a', 'file:///tmp/private', '//example.com', 'https://', ' https://example.com', '  '])('rejects unsafe or malformed source links: %s', url => {
    const draft = fullDraft(); draft.content.sources[0].url = url;
    expect(validateNoteDraft(draft)).not.toBeNull();
  });

  it('rejects malformed structures, duplicate nested IDs, missing parents and cycles', () => {
    const duplicate = fullDraft(); duplicate.content.fields.push({ ...duplicate.content.fields[0] });
    expect(validateNoteDraft(duplicate)).not.toBeNull();
    const missing = fullDraft(); missing.content.nodes[1].parentId = 'missing';
    expect(validateNoteDraft(missing)).not.toBeNull();
    const cycle = fullDraft(); cycle.content.nodes[0].parentId = 'b';
    expect(validateNoteDraft(cycle)).toContain('kreisförmig');
    const malformed = fullDraft(); (malformed.content as unknown as Record<string, unknown>).sources = null;
    expect(validateNoteDraft(malformed)).not.toBeNull();
    const invalidTag = fullDraft(); invalidTag.tags = [' '];
    expect(validateNoteDraft(invalidTag)).not.toBeNull();
  });

  it('enforces handwriting stroke, aggregate point, geometry and size limits', () => {
    const draft = createNoteDraft('handwriting');
    draft.content.strokes = Array.from({ length: 500 }, (_, index) => ({ id: String(index), color: '#000000', width: 1, points: [[0, 0]] }));
    expect(validateNoteDraft(draft)).toBeNull();
    draft.content.strokes.push({ ...draft.content.strokes[0], id: 'extra' });
    expect(validateNoteDraft(draft)).toContain('500');
    draft.content.strokes = [{ id: 's', color: '#000', width: 1, points: Array.from({ length: 30_000 }, () => [100, 200]) }];
    expect(validateNoteDraft(draft)).toBeNull();
    draft.content.strokes[0].points.push([100, 200]);
    expect(validateNoteDraft(draft)).toContain('umfangreich');
    draft.content.strokes[0].points = [[1001, 200]];
    expect(validateNoteDraft(draft)).toContain('Schreibfläche');
    draft.content.strokes[0].points = [];
    expect(validateNoteDraft(draft)).not.toBeNull();
    draft.content.strokes = [];
    draft.content.text = '界'.repeat(100_000); draft.content.cues = draft.content.text; draft.content.summary = draft.content.text;
    draft.content.fields = Array.from({ length: 20 }, (_, index) => ({ id: String(index), label: 'Feld', value: '界'.repeat(5000) }));
    expect(validateNoteDraft(draft)).toContain('zu groß');
  });

  it('searches structured content without accents, previews actual values and clones without metadata', () => {
    const draft = fullDraft();
    expect(noteSearchText(draft)).toEqual(expect.stringContaining('ubergabe strasse'));
    for (const value of ['anne', 'ruckruf', 'ozlem', 'https://example.com/info', 'thema', 'detail']) expect(noteSearchText(draft)).toContain(value);
    expect(notePreview(draft)).toBe('Gespräch vorbereiten');
    const record: OfficeNote = { ...draft, id: newNoteId(), tenantId: newNoteId(), ownerUserId: newNoteId(), revision: 3, createdAt: '2026-10-17T12:00:00Z', updatedAt: '2026-10-17T13:00:00Z', archivedAt: null };
    const copy = noteToDraft(record);
    expect(copy).not.toHaveProperty('revision');
    expect(draftsEqual(copy, draft)).toBe(true);
    copy.content.fields[0].value = 'Geändert';
    expect(record.content.fields[0].value).toBe('Änne');
    expect(draftsEqual(copy, draft)).toBe(false);
    const reordered = { ...draft, content: Object.fromEntries(Object.entries(draft.content).reverse()) } as NoteDraft;
    expect(draftsEqual(draft, reordered)).toBe(true);
  });
});
