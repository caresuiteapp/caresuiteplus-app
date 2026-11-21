import { describe, expect, it } from 'vitest';
import { detectNeoWorkRequest, findNeoWorkCandidates, isNeoWorkDate, neoWorkSourcesCurrent, neoWorkText, parseNeoWorkFields, prepareNeoWork, reviewNeoWork } from '@/ai/neo/neoWork';
import type { NeoSegment } from '@/ai/neo/neoDomain';
const scope = { tenantId: '11111111-1111-4111-8111-111111111111', actorId: '22222222-2222-4222-8222-222222222222', subjectId: '33333333-3333-4333-8333-333333333333' };
const id = '44444444-4444-4444-8444-444444444444', other = '55555555-5555-4555-8555-555555555555';
const source = (change: Partial<NeoSegment> = {}): NeoSegment => ({ id, text: 'Bitte den fehlenden Arztbericht anfordern.', role: 'professional', speaker: 'Pflegekraft Maria', startedAt: 10, endedAt: 20, ...change });
const input = { id: 'draft-1', kind: 'task' as const, title: 'Arztbericht anfordern', assignee: 'Maria, bestätigt', dueOn: '2090-11-25' };
describe('NEO evidence-backed work preparation', () => {
  it('reads explicitly labelled task fields without assigning extra facts', () => {
    expect(parseNeoWorkFields('Erstelle eine Aufgabe: Rollator besorgen. Zuständig: Pflegekraft. Fällig: 25.11.2026')).toEqual({
      title: 'Rollator besorgen', assignee: 'Pflegekraft', dueOn: '2026-11-25',
    });
    expect(parseNeoWorkFields('Wiedervorlage: Arztbericht prüfen; Verantwortlich: Maria; Frist: 2026-12-03')).toEqual({
      title: 'Arztbericht prüfen', assignee: 'Maria', dueOn: '2026-12-03',
    });
  });
  it('resolves an explicitly due tomorrow against Berlin rather than UTC or a fixed duration', () => {
    expect(parseNeoWorkFields('Aufgabe: Arztbrief anfordern. Fällig: morgen', new Date('2026-11-20T23:30:00Z')).dueOn).toBe('2026-11-22');
    expect(parseNeoWorkFields('Aufgabe: Rückruf. Fällig: morgen', new Date('2026-03-28T23:30:00Z')).dueOn).toBe('2026-03-30');
    expect(parseNeoWorkFields('Aufgabe: Rückruf bis übermorgen', new Date('2026-12-30T12:00:00Z')).dueOn).toBe('2027-01-01');
  });
  it('leaves absent or ambiguous responsibility and due dates unfilled', () => {
    expect(parseNeoWorkFields('Erstelle eine Aufgabe für Peter')).toEqual({});
    expect(parseNeoWorkFields('Aufgabe: Rollator für Peter besorgen')).toEqual({ title: 'Rollator für Peter besorgen' });
    expect(parseNeoWorkFields('Aufgabe: Arztbericht. Zuständig: Maria oder Peter. Fällig: morgen oder übermorgen')).toEqual({ title: 'Arztbericht' });
  });
  it('rejects impossible, incomplete and conflicting labelled due dates without choosing the first', () => {
    for (const due of ['2026-02-29', '31.11.2026', '25.11.', '25.11.2026 oder 26.11.2026']) expect(parseNeoWorkFields(`Aufgabe: Rückruf. Fällig: ${due}`)).not.toHaveProperty('dueOn');
    expect(parseNeoWorkFields('Aufgabe: Rückruf. Fällig: 25.11.2026. Fällig: 26.11.2026')).not.toHaveProperty('dueOn');
    expect(parseNeoWorkFields('Aufgabe: Rückruf bis morgen oder bis übermorgen')).not.toHaveProperty('dueOn');
  });
  it('does not turn a source date or a repeated morning into a due date', () => {
    expect(parseNeoWorkFields('Aufgabe: Arztbrief vom 25.11.2026 prüfen')).toEqual({ title: 'Arztbrief vom 25.11.2026 prüfen' });
    expect(parseNeoWorkFields('Aufgabe: Jeden Morgen nach dem Wohlbefinden fragen')).not.toHaveProperty('dueOn');
    expect(parseNeoWorkFields('Aufgabe: Rückruf. Fällig: morgen', new Date('invalid'))).not.toHaveProperty('dueOn');
  });
  it('keeps parsed administrative fields separate from original speaker roles and quotations', () => {
    const segment = source({ role: 'relative', speaker: 'Tochter', text: 'Meine Mutter benötigt einen Rollator.' });
    const fields = parseNeoWorkFields('Aufgabe: Rollator besorgen. Zuständig: Pflegekraft. Fällig: 25.11.2026');
    const draft = prepareNeoWork(scope, [segment], { id: 'parsed-1', kind: 'task', ...fields });
    expect(draft.assignee).toBe('Pflegekraft'); expect(draft.sources[0]).toEqual(segment); expect(neoWorkText(draft)).toContain('Angehörige, Fremdauskunft');
  });
  it('prepares task, follow-up and handover categories without treating negation or conditions as commands', () => {
    expect(detectNeoWorkRequest('NEO, erstelle eine Aufgabe')).toBe('task');
    expect(detectNeoWorkRequest('Erinnere mich an den Rückruf')).toBe('follow_up');
    expect(detectNeoWorkRequest('Fasse das Gespräch zusammen')).toBe('handover');
    expect(detectNeoWorkRequest('NEO, bereite die Übergabe vor.')).toBe('handover');
    expect(detectNeoWorkRequest('Bitte keine Erinnerung erstellen')).toBeNull();
    expect(detectNeoWorkRequest('Falls der Arzt kommt, erstelle eine Aufgabe')).toBeNull();
  });
  it('keeps only explicit non-conditional candidate statements and never infers a speaker role', () => {
    const list = [source(), source({ id: other, text: 'Bitte keinen Arztkontakt herstellen.' })];
    expect(findNeoWorkCandidates(list)).toEqual([{ segmentId: id, text: list[0].text, kind: 'task' }]);
    expect(findNeoWorkCandidates([source({ role: 'unknown' })])).toEqual([]);
    expect(findNeoWorkCandidates([source({ text: 'Neo, erstelle eine Aufgabe.' })])).toEqual([]);
    expect(findNeoWorkCandidates([source({ text: 'Überprüfen Sie bitte den Eingang des Arztbriefs.' })])).toHaveLength(1);
  });
  it('asks about responsibility, due date, task content and unassigned speakers instead of filling defaults', () => {
    const draft = prepareNeoWork(scope, [source({ role: 'unknown' })], { id: 'draft-1', kind: 'task' });
    expect(draft.assignee).toBe(''); expect(draft.dueOn).toBe(''); expect(draft.questions).toHaveLength(4);
    expect(() => reviewNeoWork(draft, scope, [source({ role: 'unknown' })])).toThrow('Wer hat');
  });
  it('preserves whole negated and family statements in a handover and requires assigned speakers', () => {
    const family = source({ role: 'relative', speaker: 'Tochter', text: 'Meine Mutter hat keine Schmerzen. Ich bin mir bei der Tablette nicht sicher.' });
    const draft = reviewNeoWork(prepareNeoWork(scope, [family], { id: 'handover-1', kind: 'handover' }), scope, [family]);
    const result = neoWorkText(draft); expect(result).toContain('Angehörige, Fremdauskunft'); expect(result).toContain(family.text);
    expect(result).not.toContain('Tablette verabreichen'); expect(draft.reviewed).toBe(true); expect(draft.questions).toEqual([]);
  });
  it('refuses task review from an uncertain or negated source even with all administrative fields filled', () => {
    const segment = source({ text: 'Vielleicht soll Maria den Arztbericht anfordern.' });
    const draft = prepareNeoWork(scope, [segment], input);
    expect(draft.questions.join(' ')).toContain('Unsicherheit'); expect(() => reviewNeoWork(draft, scope, [segment])).toThrow('Unsicherheit');
  });
  it('binds a reviewed draft to the exact person, speaker, wording and original timing', () => {
    const segment = source(), draft = prepareNeoWork(scope, [segment], input);
    expect(reviewNeoWork(draft, scope, [segment]).reviewed).toBe(true);
    for (const change of [{ text: 'Anderer Auftrag' }, { speaker: 'Arzt' }, { role: 'person' as const }, { endedAt: 21 }]) {
      expect(neoWorkSourcesCurrent(draft, scope, [{ ...segment, ...change }])).toBe(false);
      expect(() => reviewNeoWork(draft, scope, [{ ...segment, ...change }])).toThrow('geändert');
    }
    expect(() => reviewNeoWork(draft, { ...scope, subjectId: other }, [segment])).toThrow('geändert');
    expect(() => reviewNeoWork(draft, scope, [])).toThrow('geändert');
  });
  it('does not invalidate an exact cited statement merely because more ambient evidence arrives', () => {
    const segment = source(), draft = prepareNeoWork(scope, [segment], { ...input, sourceIds: [id] });
    expect(neoWorkSourcesCurrent(draft, scope, [segment, source({ id: other, text: 'Sie nutzt einen Rollator.' })])).toBe(true);
    expect(draft.sources).toHaveLength(1);
  });
  it('rejects missing source IDs, empty evidence, invalid scope and impossible dates', () => {
    expect(() => prepareNeoWork(scope, [source()], { ...input, sourceIds: [other] })).toThrow('nicht mehr vorhanden');
    expect(prepareNeoWork(scope, [], input).questions).toContain('Welche Gesprächsaussage gehört zu diesem Entwurf?');
    expect(() => prepareNeoWork({ ...scope, tenantId: 'wrong' }, [source()], input)).toThrow();
    expect(isNeoWorkDate('2028-02-29')).toBe(true); expect(isNeoWorkDate('2026-02-29')).toBe(false); expect(isNeoWorkDate('morgen')).toBe(false);
  });
  it('copies the source snapshot so later in-place changes cannot silently alter a prepared draft', () => {
    const segment = source(), draft = prepareNeoWork(scope, [segment], input); segment.text = 'Nachträglich geändert';
    expect(draft.sources[0].text).toBe('Bitte den fehlenden Arztbericht anfordern.'); expect(neoWorkSourcesCurrent(draft, scope, [segment])).toBe(false);
  });
});
