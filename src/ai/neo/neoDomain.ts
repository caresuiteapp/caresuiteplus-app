export const NEO_VERSION = '1.0.0';
export const NEO_TOPICS = {
  cognition_communication: 'Kognition und Kommunikation', mobility: 'Mobilität',
  disease_demands: 'Gesundheit und Behandlung', self_care: 'Selbstversorgung',
  social_relationships: 'Soziale Beziehungen', living_environment: 'Wohnen und Alltag',
} as const;
export type NeoTopic = keyof typeof NEO_TOPICS;
export type NeoRole = 'person' | 'relative' | 'professional' | 'unknown';
export type NeoScope = { tenantId: string; actorId: string; subjectId: string; assessmentId?: string };
export type NeoSegment = { id: string; text: string; role: NeoRole; speaker: string; startedAt: number; endedAt: number };
export type NeoFact = {
  id: string; topic: NeoTopic; field: 'personPerspective' | 'resources' | 'impairments' | 'wishes' | 'habitsBiography';
  text: string; quote: string; segmentId: string; role: NeoRole; speaker: string;
  status: 'reported' | 'negated' | 'historical' | 'uncertain' | 'family';
  decision: 'pending' | 'accepted' | 'rejected';
};
export type NeoDraft = { version: typeof NEO_VERSION; facts: NeoFact[]; openQuestions: string[]; engine: 'rules' | 'local-model' };
export const neoUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function neoScopeKey(scope: NeoScope): string { return JSON.stringify([scope.tenantId, scope.actorId, scope.subjectId, scope.assessmentId ?? '']); }
export function assertNeoScope(scope: NeoScope): void {
  if (![scope.tenantId, scope.actorId, scope.subjectId].every(neoUuid) || scope.assessmentId && !neoUuid(scope.assessmentId)) throw Error('NEO benötigt einen bestätigten Personen- und Unternehmensbezug.');
}
export function assertNeoSegments(segments: NeoSegment[]): void {
  if (!Array.isArray(segments) || segments.length > 200) throw Error('Dieses Gespräch ist zu umfangreich. Bitte einen weiteren Abschnitt beginnen.');
  const ids = new Set<string>(); let characters = 0;
  for (const segment of segments) {
    if (!neoUuid(segment.id) || ids.has(segment.id) || typeof segment.text !== 'string' || !segment.text.trim() || segment.text.length > 6000
      || !['person', 'relative', 'professional', 'unknown'].includes(segment.role) || typeof segment.speaker !== 'string' || segment.speaker.length > 100
      || !Number.isFinite(segment.startedAt) || segment.startedAt < 0 || !Number.isFinite(segment.endedAt) || segment.endedAt < segment.startedAt) throw Error('Ein Gesprächsabschnitt ist ungültig.');
    ids.add(segment.id); characters += segment.text.length;
  }
  if (characters > 60000) throw Error('Bitte das Gespräch in kürzere Abschnitte aufteilen.');
}

const topics: [NeoTopic, RegExp][] = [
  ['cognition_communication', /\b(?:orientier\w*|gedächtnis|vergess\w*|versteh\w*|sprech\w*|hören|hörgerät\w*|seh\w*|brille|dement\w*|kommunik\w*)\b/i],
  ['mobility', /\b(?:geh\w*|lauf\w*|rollator\w*|rollstuhl\w*|trepp\w*|mobil\w*|stürz\w*|sturz\w*|transfer\w*|aufsteh\w*|stehen|beweg\w*)\b/i],
  ['disease_demands', /\b(?:schmerz\w*|allerg\w*|vertrage|unverträg\w*|diabet\w*|insulin|medikament\w*|tablett\w*|blutdruck|puls|temperatur|fieber|wund\w*|penicillin|verordnung\w*|arzt\w*|ärzt\w*|diagnos\w*)\b/i],
  ['self_care', /\b(?:dusch\w*|wasch\w*|anzieh\w*|auszieh\w*|ankleid\w*|kleid\w*|ess\w*|trink\w*|ernähr\w*|toilette\w*|inkontinen\w*|körperpflege|zahn\w*|ausscheid\w*)\b/i],
  ['social_relationships', /\b(?:einsam\w*|kontakt\w*|besuch\w*|freund\w*|familie|tochter|sohn|ehemann|partner\w*|angst|ängst\w*|traurig\w*|depress\w*|schlaf\w*|hobby\w*)\b/i],
  ['living_environment', /\b(?:wohn\w*|haushalt\w*|putz\w*|einkauf\w*|kochen|haushalts\w*|schlüssel|barriere\w*|notruf\w*|wohnung\w*|garten\w*)\b/i],
];
export function neoEvidenceClauses(text: string): string[] {
  // Split only at sentence boundaries. Decimal values and dates remain intact.
  return text.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ])|\n+/u).map(part => part.trim()).filter(Boolean);
}
function statementStatus(text: string, role: NeoRole): NeoFact['status'] {
  if (role === 'relative' && /^\s*(?:ich|mir|mein\w*)\b/i.test(text)) return 'family';
  if (/\b(?:meine? (?:mutter|vater|oma|opa|schwester|bruder)|der nachbar|die nachbarin)\b/i.test(text)) return 'family';
  if (/\b(?:glaube|vielleicht|vermut\w*|eventuell|möglicherweise|weiß nicht|weiss nicht|unsicher)\b/i.test(text)) return 'uncertain';
  if (/\b(?:früher|damals|bis (?:märz|april|mai|juni|juli|august|september|oktober|november|dezember|januar|februar)|seit .*nicht mehr)\b/i.test(text)) return 'historical';
  if (/\b(?:kein\w*|nicht|nie|vernein\w*|ohne)\b/i.test(text)) return 'negated';
  return 'reported';
}
function statementField(text: string, role: NeoRole): NeoFact['field'] {
  if (role === 'person') return 'personPerspective';
  if (/\b(?:wünsch\w*|möchte|will|ziel)\b/i.test(text)) return 'wishes';
  if (/\b(?:gewohn\w*|immer|früher|jeden (?:tag|morgen|abend))\b/i.test(text)) return 'habitsBiography';
  // Third-party reports remain quotations; NEO never labels them a professional assessment.
  return 'personPerspective';
}
/** Conservative own extraction: copy evidence, never complete diagnoses or absent facts. */
export function extractNeoFacts(segments: NeoSegment[]): NeoDraft {
  assertNeoSegments(segments);
  const facts: NeoFact[] = [], openQuestions: string[] = [];
  for (const segment of segments) {
    if (segment.role === 'unknown') { openQuestions.push(`Sprecher zuordnen: ${segment.text.slice(0, 100)}`); continue; }
    const clauses = neoEvidenceClauses(segment.text);
    for (const [index, raw] of clauses.entries()) {
      const quote = raw.trim();
      if (!quote || quote.endsWith('?')) continue;
      const matches = topics.filter(([, pattern]) => pattern.test(quote));
      if (!matches.length) continue;
      const status = statementStatus(quote, segment.role);
      for (const [topic] of matches) {
      const fact: NeoFact = { id: `${segment.id}:${index}:${topic}`, topic, field: statementField(quote, segment.role),
        text: quote, quote, segmentId: segment.id, role: segment.role, speaker: segment.speaker, status, decision: 'pending' };
      facts.push(fact);
      }
      if (status === 'uncertain') openQuestions.push(`Angabe klären: ${quote}`);
    }
  }
  return { version: NEO_VERSION, facts, openQuestions: [...new Set(openQuestions)], engine: 'rules' };
}
/** Model output cannot supply invented sources, speaker roles or arbitrary destination fields. */
export function validateNeoModelDraft(value: unknown, segments: NeoSegment[]): NeoDraft {
  assertNeoSegments(segments);
  const candidate = value as { facts?: unknown; openQuestions?: unknown };
  if (!candidate || !Array.isArray(candidate.facts) || candidate.facts.length > 200) throw Error('Das Sprachmodell hat keinen gültigen Entwurf geliefert.');
  const facts = candidate.facts.map((raw, index): NeoFact => {
    const fact = raw as Record<string, unknown>, source = segments.find(s => s.id === fact.segmentId);
    if (!source || source.role === 'unknown' || typeof fact.quote !== 'string' || !fact.quote.trim() || !neoEvidenceClauses(source.text).includes(fact.quote) || fact.quote.endsWith('?')
      || typeof fact.text !== 'string' || fact.text !== fact.quote || !Object.hasOwn(NEO_TOPICS, String(fact.topic))) throw Error('Eine Modellangabe besitzt keinen unveränderten Gesprächsbeleg.');
    // Identity, negation/history and target are derived from verified transcript, never model authority.
    return { id: `${source.id}:m${index}`, topic: fact.topic as NeoTopic, field: statementField(fact.quote, source.role),
      text: fact.quote, quote: fact.quote, segmentId: source.id, role: source.role, speaker: source.speaker,
      status: statementStatus(fact.quote, source.role), decision: 'pending' };
  });
  return { version: NEO_VERSION, facts, openQuestions: extractNeoFacts(segments).openQuestions, engine: 'local-model' };
}
export function validateNeoReviewedDraft(draft: NeoDraft, segments: NeoSegment[]): NeoDraft {
  const verified = validateNeoModelDraft(draft, segments);
  return { ...verified, engine: draft.engine, facts: verified.facts.map((fact, index) => {
    const original = draft.facts[index];
    if (!['pending', 'accepted', 'rejected'].includes(original.decision) || fact.role !== original.role || fact.speaker !== original.speaker || fact.status !== original.status) throw Error('Der Entwurf wurde nach der Quellenprüfung verändert.');
    return { ...fact, id: original.id, decision: original.decision };
  }) };
}
export function neoDraftText(draft: NeoDraft): string {
  const accepted = draft.facts.filter(fact => fact.decision === 'accepted');
  if (!accepted.length) throw Error('Bitte mindestens eine belegte Angabe prüfen und auswählen.');
  const labels: Record<NeoFact['status'], string> = { reported: 'Berichtet', negated: 'Verneint', historical: 'Historisch', uncertain: 'Ungeklärt', family: 'Familien-/Fremdanamnese' };
  return Object.entries(NEO_TOPICS).flatMap(([key, label]) => {
    const entries = accepted.filter(fact => fact.topic === key);
    return entries.length ? [label, ...entries.map(fact => `${labels[fact.status]} · ${fact.speaker || fact.role}: ${fact.text}`), ''] : [];
  }).join('\n').trim();
}
