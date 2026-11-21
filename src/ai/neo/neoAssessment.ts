import type { CareAssessment } from '../../types/modules/careAssessment';
import { assertNeoScope, validateNeoReviewedDraft, type NeoDraft, type NeoScope, type NeoSegment } from './neoDomain';

/** Apply to the current local draft only; existing writer/version/release gates stay authoritative. */
export function applyNeoAssessment(value: CareAssessment, scope: NeoScope, draft: NeoDraft, segments: NeoSegment[]): CareAssessment {
  assertNeoScope(scope);
  if (value.tenantId !== scope.tenantId || value.id !== scope.assessmentId || value.subjectId !== scope.subjectId || value.subjectType !== 'client'
    || !['draft', 'in_progress'].includes(value.status)) throw Error('Der NEO-Entwurf gehört nicht zum aktuellen bearbeitbaren Pflegeassessment.');
  const accepted = validateNeoReviewedDraft(draft, segments).facts.filter(fact => fact.decision === 'accepted');
  if (!accepted.length) throw Error('Bitte zuerst Angaben prüfen.');
  const append = (before: string, additions: string[]) => [...new Set([...before.split('\n'), ...additions].map(s => s.trim()).filter(Boolean))].join('\n');
  const next = { ...value, topics: value.topics.map(topic => ({ ...topic, informationSources: [...topic.informationSources] })),
    conversationParticipants: [...value.conversationParticipants] };
  const patientQuotes: string[] = [];
  for (const fact of accepted) {
    if (fact.role === 'unknown' || !fact.quote || fact.text.length > 6000) throw Error('Die Angabe hat keine bestätigte Quelle.');
    const topic = next.topics.find(item => item.topicKey === fact.topic);
    if (!topic) throw Error('Das passende Themenfeld fehlt im aktuellen Assessment.');
    const source = `NEO · ${fact.speaker || fact.role} · ${fact.status} · ${fact.segmentId}`;
    // Family and uncertain statements stay explicitly qualified, never become a diagnosis/resource rating.
    topic.personPerspective = append(topic.personPerspective, [`[${fact.status === 'family' ? 'Familien-/Fremdanamnese' : fact.status === 'uncertain' ? 'Ungeklärte Angabe' : fact.status === 'historical' ? 'Historische Angabe' : fact.status === 'negated' ? 'Verneinte Angabe' : 'Berichtete Angabe'} · ${fact.speaker || fact.role}] ${fact.text}`]);
    topic.informationSources = [...new Set([...topic.informationSources, source])];
    if (fact.role === 'person' && fact.status !== 'family') patientQuotes.push(fact.quote);
    if (fact.speaker && !next.conversationParticipants.includes(fact.speaker)) next.conversationParticipants.push(fact.speaker);
  }
  if (patientQuotes.length) next.personStatement = append(next.personStatement, patientQuotes);
  next.informationSourceSummary = append(next.informationSourceSummary, ['NEO-Sprachentwurf: Quellen und Aussagen wurden vor der Übernahme geprüft.']);
  return next;
}
