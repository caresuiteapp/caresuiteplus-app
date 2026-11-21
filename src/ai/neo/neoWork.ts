import { assertNeoScope, assertNeoSegments, neoScopeKey, type NeoScope, type NeoSegment } from './neoDomain';

export type NeoWorkKind = 'task' | 'follow_up' | 'handover';
export const NEO_WORK_LABELS: Record<NeoWorkKind, string> = { task: 'Aufgabe', follow_up: 'Wiedervorlage', handover: 'Übergabe' };
export type NeoWorkDraft = {
  id: string; scopeKey: string; kind: NeoWorkKind; title: string; assignee: string; dueOn: string;
  sources: NeoSegment[]; questions: string[]; reviewed: boolean;
};
export type NeoWorkInput = { id: string; kind: NeoWorkKind; sourceIds?: readonly string[]; title?: string; assignee?: string; dueOn?: string };
export type NeoWorkCandidate = { segmentId: string; text: string; kind: 'task' | 'follow_up' };
export type NeoWorkFields = { title?: string; assignee?: string; dueOn?: string };
const conditional = /\b(?:nicht|kein\w*|nie|falls|wenn|eventuell|vielleicht|könnte|würde)\b/iu;
const addressed = /^(?:(?:hey|hallo|bitte)\s+)?neo(?:\s|[,!:?]|$)/iu;

/** Recognises a request category only. It does not execute an instruction. */
export function detectNeoWorkRequest(text: string): NeoWorkKind | null {
  const value = text.normalize('NFC').trim();
  if (!value || conditional.test(value)) return null;
  if (/(?<![\p{L}\p{N}])(?:übergabe|zusammenfassung|zusammenfassen)(?![\p{L}\p{N}])|\bfasse\b.*\bzusammen\b/iu.test(value)) return 'handover';
  if (/\b(?:wiedervorlage|erinnerung|erinnere|rückruf)\b/iu.test(value)) return 'follow_up';
  if (/\b(?:aufgabe|aufgaben|todo|to-do)\b/iu.test(value)) return 'task';
  return null;
}

/** Possible work remains a source quotation; negated and conditional instructions are not task suggestions. */
export function findNeoWorkCandidates(segments: NeoSegment[]): NeoWorkCandidate[] {
  assertNeoSegments(segments);
  return segments.filter(segment => segment.role !== 'unknown' && !addressed.test(segment.text) && !conditional.test(segment.text)
    && /(?<![\p{L}\p{N}])(?:bitte|muss|müssen|soll|sollen|benötigt|benötigen|organisieren|besorgen|nachfragen|abklären|erinnern|rückruf|wiedervorlage|kontrollieren|überprüfen)(?![\p{L}\p{N}])/iu.test(segment.text))
    .slice(-12).map(segment => ({ segmentId: segment.id, text: segment.text,
      kind: /\b(?:erinnern|rückruf|wiedervorlage)\b/iu.test(segment.text) ? 'follow_up' : 'task' }));
}

export function isNeoWorkDate(value: string): boolean {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T12:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Reads labelled fields, never an implied assignee or a date mentioned only in the task title. */
export function parseNeoWorkFields(command: string, now = new Date()): NeoWorkFields {
  const text = command.normalize('NFC').trim();
  if (!text || text.length > 2000) return {};
  const markers = [...text.matchAll(/(?<![\p{L}\p{N}])(titel|aufgabe|wiedervorlage|erinnerung|übergabe|zuständig(?:e person)?|verantwortlich|fällig(?: am)?|frist|datum)\s*:\s*/giu)];
  const values = markers.map((marker, index) => ({
    label: marker[1].toLocaleLowerCase('de-DE'),
    value: text.slice(marker.index! + marker[0].length, markers[index + 1]?.index ?? text.length).trim().replace(/[\s.;,]+$/u, ''),
  }));
  const result: NeoWorkFields = {};
  const titles = values.filter(field => ['titel', 'aufgabe', 'wiedervorlage', 'erinnerung', 'übergabe'].includes(field.label));
  const assignees = values.filter(field => field.label.startsWith('zuständig') || field.label === 'verantwortlich');
  const dueFields = values.filter(field => field.label.startsWith('fällig') || field.label === 'frist' || field.label === 'datum');
  if (titles.length === 1 && titles[0].value && titles[0].value.length <= 180) result.title = titles[0].value;
  if (assignees.length === 1 && assignees[0].value && assignees[0].value.length <= 100 && !conditional.test(assignees[0].value) && !/\boder\b/iu.test(assignees[0].value)) result.assignee = assignees[0].value;
  let due = dueFields.length === 1 ? dueFields[0].value : '';
  if (!dueFields.length) {
    const phrases = [...text.matchAll(/(?<![\p{L}\p{N}])(?:bis|fällig(?:\s+am)?)\s+(heute|morgen|übermorgen|20\d{2}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}\.20\d{2})(?![\p{L}\p{N}])/giu)];
    if (phrases.length === 1 && !/\boder\b/iu.test(text)) due = phrases[0][1];
  }
  if (isNeoWorkDate(due)) result.dueOn = due;
  else {
    const german = due.match(/^(\d{1,2})\.(\d{1,2})\.(20\d{2})$/u);
    if (german) {
      const date = `${german[3]}-${german[2].padStart(2, '0')}-${german[1].padStart(2, '0')}`;
      if (isNeoWorkDate(date)) result.dueOn = date;
    } else if (/^(?:heute|morgen|übermorgen)$/iu.test(due) && Number.isFinite(now.getTime())) {
      const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
      const date = new Date(today + 'T12:00:00Z');
      const relative = due.toLocaleLowerCase('de-DE');
      date.setUTCDate(date.getUTCDate() + (relative === 'morgen' ? 1 : relative === 'übermorgen' ? 2 : 0));
      const value = date.toISOString().slice(0, 10); if (isNeoWorkDate(value)) result.dueOn = value;
    }
  }
  return result;
}

export function prepareNeoWork(scope: NeoScope, segments: NeoSegment[], input: NeoWorkInput): NeoWorkDraft {
  assertNeoScope(scope); assertNeoSegments(segments);
  if (!input.id.trim() || input.id.length > 120 || !Object.hasOwn(NEO_WORK_LABELS, input.kind)) throw Error('Der Arbeitsentwurf ist ungültig.');
  const selected = input.sourceIds ? new Set(input.sourceIds) : null;
  if (selected && [...selected].some(id => !segments.some(segment => segment.id === id))) throw Error('Ein Gesprächsbeleg ist nicht mehr vorhanden.');
  const sources = segments.filter(segment => (!selected || selected.has(segment.id)) && !addressed.test(segment.text)).map(segment => ({ ...segment }));
  const title = (input.title ?? '').trim(), assignee = (input.assignee ?? '').trim(), dueOn = (input.dueOn ?? '').trim();
  if (title.length > 180 || assignee.length > 100 || dueOn.length > 10) throw Error('Bitte Titel, Zuständigkeit oder Datum kürzen.');
  const questions: string[] = [];
  if (!sources.length) questions.push('Welche Gesprächsaussage gehört zu diesem Entwurf?');
  if (sources.some(source => source.role === 'unknown')) questions.push('Wer hat die noch nicht zugeordneten Aussagen gemacht? Bitte die Sprecher zuerst im Gespräch zuordnen.');
  if (input.kind !== 'handover') {
    if (!title) questions.push('Was soll konkret erledigt werden?');
    if (!assignee) questions.push('Wer übernimmt die Aufgabe?');
    if (!isNeoWorkDate(dueOn)) questions.push('Bis zu welchem Datum soll die Aufgabe erledigt sein? Bitte JJJJ-MM-TT angeben.');
    if (sources.some(source => conditional.test(source.text))) questions.push('Die Quelle enthält eine Verneinung, Bedingung oder Unsicherheit. Bitte zuerst im Gespräch klären, welcher konkrete Auftrag gewünscht ist.');
  }
  return { id: input.id, scopeKey: neoScopeKey(scope), kind: input.kind, title: title || (input.kind === 'handover' ? 'Gesprächsübergabe' : ''),
    assignee, dueOn, sources, questions, reviewed: false };
}

export function neoWorkSourcesCurrent(draft: NeoWorkDraft, scope: NeoScope, segments: NeoSegment[]): boolean {
  if (draft.scopeKey !== neoScopeKey(scope)) return false;
  const current = new Map(segments.map(segment => [segment.id, segment]));
  return draft.sources.every(source => {
    const segment = current.get(source.id);
    return segment?.text === source.text && segment.role === source.role && segment.speaker === source.speaker
      && segment.startedAt === source.startedAt && segment.endedAt === source.endedAt;
  });
}

export function reviewNeoWork(draft: NeoWorkDraft, scope: NeoScope, segments: NeoSegment[]): NeoWorkDraft {
  assertNeoScope(scope); assertNeoSegments(segments);
  if (!neoWorkSourcesCurrent(draft, scope, segments)) throw Error('Der Gesprächsbeleg oder die Personenzuordnung hat sich geändert. Bitte den Entwurf neu vorbereiten.');
  const checked = prepareNeoWork(scope, segments, { ...draft, sourceIds: draft.sources.map(source => source.id) });
  if (checked.questions.length) throw Error(checked.questions[0]);
  return { ...checked, reviewed: true };
}

export function neoWorkText(draft: NeoWorkDraft): string {
  const labels: Record<NeoSegment['role'], string> = { person: 'Klient:in', professional: 'Fachperson', relative: 'Angehörige, Fremdauskunft', unknown: 'Sprecher ungeklärt' };
  return [
    `${NEO_WORK_LABELS[draft.kind]} · Entwurf${draft.reviewed ? ', geprüft' : ', ungeprüft'}`,
    draft.title, ...(draft.kind === 'handover' ? [] : [`Zuständig: ${draft.assignee || 'Noch offen'}`, `Fällig am: ${draft.dueOn || 'Noch offen'}`]),
    'Gesprächsbelege:', ...draft.sources.map((source, index) => `${index + 1}. ${source.speaker || labels[source.role]} (${labels[source.role]}; Quelle ${source.id}): „${source.text}“`),
    ...draft.questions.map(question => `Zu klären: ${question}`),
  ].filter(Boolean).join('\n');
}
