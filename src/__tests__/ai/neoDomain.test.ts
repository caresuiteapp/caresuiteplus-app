import { describe, expect, it } from 'vitest';
import { assertNeoSegments, assertNeoScope, extractNeoFacts, neoDraftText, validateNeoModelDraft, validateNeoReviewedDraft, type NeoSegment, type NeoScope } from '@/ai/neo/neoDomain';
import { applyNeoAssessment } from '@/ai/neo/neoAssessment';
import { createEmptyTopics } from '@/lib/careAssessment/catalog';
import type { CareAssessment } from '@/types/modules/careAssessment';
const scope: NeoScope = { tenantId: '11111111-1111-4111-8111-111111111111', actorId: '22222222-2222-4222-8222-222222222222', subjectId: '33333333-3333-4333-8333-333333333333', assessmentId: '44444444-4444-4444-8444-444444444444' };
const segment = (text: string, role: NeoSegment['role'] = 'person'): NeoSegment => ({ id: scope.subjectId, text, role, speaker: role === 'person' ? 'Person selbst' : role, startedAt: 100, endedAt: 200 });
const accepted = (segments: NeoSegment[]) => { const draft = extractNeoFacts(segments); return { ...draft, facts: draft.facts.map(f => ({ ...f, decision: 'accepted' as const })) }; };
const assessment = () => ({ id: scope.assessmentId, tenantId: scope.tenantId, subjectId: scope.subjectId, subjectType: 'client', status: 'draft', version: 2, draftRevision: 4, topics: createEmptyTopics(), personStatement: 'Bisheriger Wortlaut', conversationParticipants: [], informationSourceSummary: '', risks: [], measures: [], professionalSummary: 'Fachliche Bewertung bleibt erhalten' } as unknown as CareAssessment);
describe('NEO evidence and local assessment draft', () => {
  it('keeps exact negation and uncertainty without completing clinical findings', () => {
    const draft = extractNeoFacts([segment('Ich habe keine Schmerzen. Vielleicht vertrage ich Penicillin nicht.')]);
    expect(draft.facts.map(f => [f.text, f.status])).toEqual([['Ich habe keine Schmerzen.', 'negated'], ['Vielleicht vertrage ich Penicillin nicht.', 'uncertain']]);
    expect(draft.openQuestions).toHaveLength(1); expect(draft.facts.every(f => f.decision === 'pending')).toBe(true);
  });
  it('keeps decimal doses and full dates in their original sentence', () => {
    const quote = 'Seit dem 20.11.2026 nehme ich 2.5 Tabletten.';
    expect(extractNeoFacts([segment(quote)]).facts.map(f => f.quote)).toEqual([quote]);
  });
  it('places an evidenced sentence in every matching topic', () => {
    expect(extractNeoFacts([segment('Mit dem Rollator erreiche ich die Dusche.')]).facts.map(f => f.topic)).toEqual(['mobility', 'self_care']);
  });
  it('keeps third-person family disease separate from the person’s own findings', () => {
    expect(extractNeoFacts([segment('Meine Mutter hat Diabetes.')]).facts[0].status).toBe('family');
  });
  it('does not turn a question or unassigned speaker into a finding', () => {
    expect(extractNeoFacts([segment('Haben Sie Schmerzen?')]).facts).toEqual([]);
    const unknown = extractNeoFacts([segment('Ich nutze einen Rollator.', 'unknown')]);
    expect(unknown.facts).toEqual([]); expect(unknown.openQuestions[0]).toContain('Sprecher');
  });
  it.each(['Schmerzen', 'Ich habe Schmerzen.', 'Keine Beschwerden.'])('rejects a model quote with missing negation or no evidence: %s', quote => {
    const source = segment('Ich habe keine Schmerzen.');
    expect(() => validateNeoModelDraft({ facts: [{ segmentId: source.id, topic: 'disease_demands', text: quote, quote }] }, [source])).toThrow();
  });
  it('derives speaker and status from the transcript despite a model-supplied authority', () => {
    const source = segment('Ich habe keine Schmerzen.');
    const result = validateNeoModelDraft({ facts: [{ segmentId: source.id, topic: 'disease_demands', quote: source.text, text: source.text, role: 'professional', status: 'reported' }] }, [source]);
    expect(result.facts[0]).toMatchObject({ role: 'person', status: 'negated', decision: 'pending' });
  });
  it('rejects model actions, unknown topics and question quotations', () => {
    const source = segment('Haben Sie Schmerzen?');
    expect(() => validateNeoModelDraft({ facts: [{ segmentId: source.id, topic: 'disease_demands', text: source.text, quote: source.text }] }, [source])).toThrow();
    expect(() => validateNeoModelDraft({ facts: [{ segmentId: source.id, topic: 'execute_sql', text: source.text, quote: source.text }] }, [source])).toThrow();
  });
  it('detects speaker tampering between extraction and application', () => {
    const segments = [segment('Ich nutze einen Rollator.')], draft = accepted(segments);
    draft.facts[0].speaker = 'Andere Person'; expect(() => validateNeoReviewedDraft(draft, segments)).toThrow();
  });
  it('applies reviewed quotations idempotently without altering revisions, risk or professional decisions', () => {
    const segments = [segment('Ich nutze einen Rollator. Meine Mutter hat Diabetes.')], before = assessment(), draft = accepted(segments);
    const next = applyNeoAssessment(before, scope, draft, segments);
    expect(applyNeoAssessment(next, scope, draft, segments)).toEqual(next);
    expect(before.topics.every(t => t.personPerspective === '')).toBe(true);
    expect(next).toMatchObject({ status: 'draft', version: 2, draftRevision: 4, professionalSummary: before.professionalSummary, risks: [], measures: [] });
    expect(next.personStatement).toContain('Rollator'); expect(next.personStatement).not.toContain('Diabetes');
    expect(next.topics.find(t => t.topicKey === 'disease_demands')?.personPerspective).toContain('Familien-/Fremdanamnese');
    expect(next.topics.every(t => !t.professionalAssessment && !t.resources && !t.impairments)).toBe(true);
  });
  it.each([{ tenantId: scope.actorId }, { subjectId: scope.actorId }, { status: 'approved' }, { subjectType: 'resident' }])('rejects stale or noneditable assessment scope %j', change => {
    const segments = [segment('Ich nutze einen Rollator.')];
    expect(() => applyNeoAssessment({ ...assessment(), ...change } as CareAssessment, scope, accepted(segments), segments)).toThrow();
  });
  it('requires at least one selected statement for draft text', () => { expect(() => neoDraftText(extractNeoFacts([segment('Ich nutze einen Rollator.')]))).toThrow(); });
  it('rejects duplicate segments, invalid identities, oversized text and invalid times', () => {
    const s = segment('Ich nutze einen Rollator.');
    expect(() => assertNeoSegments([s, s])).toThrow(); expect(() => assertNeoSegments([{ ...s, startedAt: -1 }])).toThrow();
    expect(() => assertNeoSegments([{ ...s, text: 'x'.repeat(6001) }])).toThrow(); expect(() => assertNeoScope({ ...scope, actorId: 'anonymous' })).toThrow();
  });
});

it('does not mistake a directed work instruction for an observed medical fact', () => {
  const source = segment('Ich habe keine Schmerzen. Neo, erstelle bitte eine Aufgabe: Blutdruck kontrollieren.');
  const draft = extractNeoFacts([source]);
  expect(draft.facts).toHaveLength(1); expect(draft.facts[0]).toMatchObject({ quote: 'Ich habe keine Schmerzen.', status: 'negated' });
  const quote = 'Neo, erstelle bitte eine Aufgabe: Blutdruck kontrollieren.';
  expect(() => validateNeoModelDraft({ facts: [{ segmentId: source.id, quote, text: quote, topic: 'disease_demands' }] }, [source])).toThrow();
});
