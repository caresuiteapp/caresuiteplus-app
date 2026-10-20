// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNoteDraft } from '@/lib/office/notes/model.web';
import { buildNoteExport, downloadNote, safeNoteSourceUrl } from '@/lib/office/notes/export.web';

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
describe('Office note exports', () => {
  it('exports every stored content type even when free text is the selected format', () => {
    const draft = createNoteDraft(); draft.title = 'Besprechung'; draft.content.text = 'Entscheidung festhalten';
    draft.content.cues = 'Warum?'; draft.content.summary = 'Ergebnis'; draft.tags = ['Team']; draft.pinned = true; draft.dueDate = '2026-11-03';
    draft.content.fields = [{ id: 'f', label: 'Name', value: 'Alex' }];
    draft.content.tasks = [{ id: 't', text: 'Rückruf', status: 'done', assignee: 'Alex', dueDate: '2026-11-04' }];
    draft.content.sources = [{ id: 's', title: 'Quelle', url: 'https://example.org/ref(1)' }];
    draft.content.nodes = [{ id: 'n1', parentId: null, text: 'Ziel', x: 500, y: 300 }, { id: 'n2', parentId: 'n1', text: 'Schritt', x: 700, y: 400 }];
    draft.content.strokes = [{ id: 'stroke', color: '#17384d', width: 2, points: [[1, 1], [4, 4]] }];
    const before = structuredClone(draft);
    const markdown = buildNoteExport(draft, 'markdown');
    expect(markdown.filename).toBe('Besprechung.md');
    for (const value of ['Entscheidung festhalten', 'Warum?', 'Ergebnis', 'Schlagwörter: Team', '**Name:** Alex', '[x] Rückruf', 'Verantwortlich: Alex', 'Frist: 2026-11-04', '[Quelle](https://example.org/ref%281%29)', 'Schritt — gehört zu: Ziel', '1 gespeicherte Striche']) expect(markdown.content).toContain(value);
    expect(JSON.parse(buildNoteExport(draft, 'json').content)).toEqual({ schema: 'caresuite-office-note', version: 1, note: draft });
    expect(draft).toEqual(before);
  });

  it.each(['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'file:///etc/passwd', '//example.org/file', 'mailto:test@example.org', ''])('does not turn %s into a clickable source', url => {
    expect(safeNoteSourceUrl(url)).toBeNull();
    const draft = createNoteDraft(); draft.content.sources = [{ id: 's', title: 'Source', url }];
    expect(buildNoteExport(draft, 'markdown').content).not.toContain('[Source](');
  });

  it('preserves Unicode names and uses a safe filename, with escaped HTML and link titles in Markdown', () => {
    const draft = createNoteDraft(); draft.title = '../Rückruf: <Team>/Plan';
    draft.content.text = '<script>alert(1)</script>';
    draft.content.sources = [{ id: 's', title: '[x](javascript:alert(1))', url: 'https://example.org' }];
    const result = buildNoteExport(draft, 'markdown');
    expect(result.filename).toBe('-Rückruf- -Team--Plan.md'); expect(result.content).not.toContain('<script>');
    expect(result.content).toContain('&lt;script&gt;'); expect(result.content).toContain('\\[x\\](javascript:alert(1))');
  });

  it('creates a real downloaded file and releases its object URL after the download starts', () => {
    vi.useFakeTimers(); const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:note-export'); const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    let captured: HTMLAnchorElement | undefined;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { captured = this; expect(this.isConnected).toBe(true); });
    const draft = createNoteDraft(); draft.title = 'Kontakt'; downloadNote(draft, 'json');
    expect(create).toHaveBeenCalledOnce(); expect(create.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(captured?.download).toBe('Kontakt.json'); expect(captured?.href).toBe('blob:note-export'); expect(captured?.isConnected).toBe(false);
    expect(revoke).not.toHaveBeenCalled(); vi.advanceTimersByTime(1000); expect(revoke).toHaveBeenCalledWith('blob:note-export');
  });
});
