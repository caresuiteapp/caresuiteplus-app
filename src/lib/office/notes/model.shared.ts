import {secureRandomId} from '@/lib/platform/secureRandomId';
import type { NoteCategory, NoteDraft, NoteFormat, NoteStatus, OfficeNote } from './types.web';

export const NOTE_CATEGORIES: { value: NoteCategory; label: string; description: string }[] = [
  { value: 'general', label: 'Fakten & Informationen', description: 'Wichtige Angaben und Beobachtungen festhalten.' },
  { value: 'contacts', label: 'Kontakte', description: 'Namen, Erreichbarkeit und Gesprächsnotizen sammeln.' },
  { value: 'dates', label: 'Termine & Daten', description: 'Zeitpunkte, Orte und Vereinbarungen notieren.' },
  { value: 'knowledge', label: 'Wissen', description: 'Erkenntnisse erklären und Zusammenhänge festhalten.' },
  { value: 'sources', label: 'Quellen', description: 'Fundstellen und weiterführende Links sammeln.' },
  { value: 'tasks', label: 'Aufgaben', description: 'Aufgaben mit Zuständigkeiten und Fälligkeit ordnen.' },
  { value: 'decisions', label: 'Entscheidungen', description: 'Entscheidungen und ihre Gründe dokumentieren.' },
  { value: 'next_steps', label: 'Nächste Schritte', description: 'Aus einer Überlegung konkrete Schritte ableiten.' },
  { value: 'ideas', label: 'Ideen', description: 'Einfälle sammeln und weiterentwickeln.' },
  { value: 'reflections', label: 'Reflexionen', description: 'Erfahrungen einordnen und daraus lernen.' },
  { value: 'questions', label: 'Fragen', description: 'Offene Fragen und spätere Antworten festhalten.' },
];
export const NOTE_FORMATS: { value: NoteFormat; label: string; description: string }[] = [
  { value: 'plain', label: 'Freie Notiz', description: 'Text, Angaben, Aufgaben und Quellen frei kombinieren.' },
  { value: 'cornell', label: 'Cornell', description: 'Stichworte, ausführliche Notizen und Zusammenfassung trennen.' },
  { value: 'mindmap', label: 'Mindmap', description: 'Gedanken als verbundene Themen anordnen.' },
  { value: 'handwriting', label: 'Handschrift', description: 'Mit Stift, Finger oder Maus schreiben und zeichnen.' },
];
export const NOTE_STATUSES: { value: NoteStatus; label: string }[] = [
  { value: 'open', label: 'Offen' }, { value: 'in_progress', label: 'In Bearbeitung' }, { value: 'done', label: 'Erledigt' },
];
export const NOTE_TEMPLATES: { id: string; label: string; description: string; category: NoteCategory; format: NoteFormat }[] = [
  { id: 'blank', label: 'Leere Notiz', description: 'Mit einem freien Blatt beginnen.', category: 'general', format: 'plain' },
  { id: 'contact', label: 'Kontakt', description: 'Name, Organisation und Erreichbarkeit festhalten.', category: 'contacts', format: 'plain' },
  { id: 'appointment', label: 'Terminnotiz', description: 'Anlass, Ort und Vereinbarungen festhalten.', category: 'dates', format: 'plain' },
  { id: 'knowledge', label: 'Wissensnotiz', description: 'Begriffe, Erkenntnisse und eine Zusammenfassung sammeln.', category: 'knowledge', format: 'cornell' },
  { id: 'source', label: 'Quellensammlung', description: 'Fundstellen mit eigenen Anmerkungen verbinden.', category: 'sources', format: 'plain' },
  { id: 'task', label: 'Aufgabenliste', description: 'Arbeitsschritte mit Status und Fälligkeit ergänzen.', category: 'tasks', format: 'plain' },
  { id: 'decision', label: 'Entscheidungsnotiz', description: 'Entscheidung, Gründe und Verantwortung festhalten.', category: 'decisions', format: 'plain' },
  { id: 'next_steps', label: 'Nächste Schritte', description: 'Ziel, nächsten Schritt und Erfolgskriterium klären.', category: 'next_steps', format: 'plain' },
  { id: 'idea', label: 'Ideensammlung', description: 'Gedanken auf einer Mindmap verbinden.', category: 'ideas', format: 'mindmap' },
  { id: 'reflection', label: 'Reflexion', description: 'Erfahrung, Erkenntnisse und Veränderungen durchdenken.', category: 'reflections', format: 'cornell' },
  { id: 'question', label: 'Offene Fragen', description: 'Fragen, Antworten und nächste Recherche festhalten.', category: 'questions', format: 'plain' },
  { id: 'cornell', label: 'Cornell-Blatt', description: 'Stichworte links, Notizen rechts, Zusammenfassung darunter.', category: 'knowledge', format: 'cornell' },
  { id: 'mindmap', label: 'Mindmap', description: 'Ein zentrales Thema mit Unterthemen entwickeln.', category: 'ideas', format: 'mindmap' },
  { id: 'handwriting', label: 'Handschriftliches Blatt', description: 'Eine freie Schreib- und Zeichenfläche öffnen.', category: 'general', format: 'handwriting' },
];

export function newNoteId():string{return secureRandomId();}

export function createNoteDraft(templateId = 'blank', makeId: () => string = newNoteId): NoteDraft {
  const template = NOTE_TEMPLATES.find(item => item.id === templateId) ?? NOTE_TEMPLATES[0];
  const labels: Record<string, string[]> = {
    contact: ['Name', 'Organisation', 'Telefon', 'E-Mail'],
    appointment: ['Anlass', 'Datum und Uhrzeit', 'Ort', 'Vereinbarung'],
    knowledge: ['Thema', 'Kernaussage'], source: ['Recherchethema'],
    decision: ['Entscheidung', 'Begründung', 'Verantwortlich'],
    next_steps: ['Ziel', 'Nächster Schritt', 'Erfolgskriterium'],
    question: ['Frage', 'Antwort', 'Weitere Recherche'],
  };
  return {
    title: '', category: template.category, format: template.format, status: 'open', tags: [], dueDate: '', pinned: false,
    content: { text: '', cues: templateId === 'reflection' ? 'Was ist gelungen?\nWas möchte ich ändern?' : '', summary: '',
      fields: (labels[templateId] ?? []).map(label => ({ id: makeId(), label, value: '' })),
      tasks: [], sources: [], nodes: [], strokes: [] },
  };
}

const isText = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max && !value.includes('\0');
const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
function validDate(value: unknown): value is string {
  if (value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function validItems(value: unknown, max: number): value is Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length > max) return false;
  const ids = new Set<string>();
  return value.every(item => {
    if (!isObject(item) || !isText(item.id, 100) || !item.id.trim() || ids.has(item.id)) return false;
    ids.add(item.id); return true;
  });
}
function safeSource(value: unknown): boolean {
  if (!isText(value, 2048)) return false;
  if (value === '') return true;
  if (/\s/.test(value) || !/^https?:\/\//i.test(value)) return false;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname); } catch { return false; }
}
const validStatus = (value: unknown) => NOTE_STATUSES.some(status => status.value === value);
const validCoordinate = (value: unknown, max: number) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;

export function validateNoteDraft(draft: NoteDraft): string | null {
  if (!isObject(draft) || !isText(draft.title, 240)) return 'Der Titel darf höchstens 240 Zeichen enthalten.';
  if (!NOTE_CATEGORIES.some(item => item.value === draft.category) || !NOTE_FORMATS.some(item => item.value === draft.format) || !validStatus(draft.status)) return 'Bitte Kategorie, Notizform und Status prüfen.';
  if (typeof draft.pinned !== 'boolean' || !validDate(draft.dueDate)) return 'Bitte die Fälligkeit der Notiz prüfen.';
  if (!Array.isArray(draft.tags) || draft.tags.length > 30 || draft.tags.some(tag => !isText(tag, 40) || !tag.trim())) return 'Maximal 30 Schlagworte mit jeweils 40 Zeichen sind möglich.';
  const content = draft.content;
  if (!isObject(content) || !(['text', 'cues', 'summary'] as const).every(key => isText(content[key], 100_000))) return 'Text, Stichworte und Zusammenfassung dürfen jeweils höchstens 100.000 Zeichen enthalten.';
  if (!validItems(content.fields, 80) || content.fields.some(field => !isText(field.label, 100) || !isText(field.value, 5000))) return 'Bitte die Angaben prüfen: maximal 80 Felder, 100 Zeichen je Bezeichnung und 5.000 Zeichen je Inhalt.';
  if (!validItems(content.tasks, 200) || content.tasks.some(task => !isText(task.text, 2000) || !isText(task.assignee, 160) || !validStatus(task.status) || !validDate(task.dueDate))) return 'Bitte die Aufgaben prüfen: maximal 200 Einträge mit gültigem Status und Datum.';
  if (!validItems(content.sources, 100) || content.sources.some(source => !isText(source.title, 240) || !safeSource(source.url))) return 'Quellen benötigen einen gültigen HTTP- oder HTTPS-Link. Maximal 100 Quellen sind möglich.';
  if (!validItems(content.nodes, 80)) return 'Eine Mindmap darf höchstens 80 Themen mit eindeutigen Kennungen enthalten.';
  const nodes = new Map(content.nodes.map(node => [node.id, node]));
  for (const node of content.nodes) {
    if (!isText(node.text, 500) || !validCoordinate(node.x, 1000) || !validCoordinate(node.y, 600)
      || (node.parentId !== null && (!isText(node.parentId, 100) || !nodes.has(node.parentId)))) return 'Bitte die Themen und Verbindungen der Mindmap prüfen.';
    const visited = new Set<unknown>([node.id]);
    let parent = node.parentId;
    while (parent !== null) {
      if (visited.has(parent)) return 'Die Mindmap darf keine kreisförmigen Elternverbindungen enthalten.';
      visited.add(parent); parent = nodes.get(parent)?.parentId ?? null;
    }
  }
  if (!validItems(content.strokes, 500)) return 'Maximal 500 Zeichenstriche pro Notiz sind möglich.';
  let pointCount = 0;
  for (const stroke of content.strokes) {
    if (!isText(stroke.color, 7) || !/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(stroke.color)
      || typeof stroke.width !== 'number' || !Number.isFinite(stroke.width) || stroke.width < 1 || stroke.width > 20
      || !Array.isArray(stroke.points) || !stroke.points.length) return 'Bitte Farbe, Strichbreite und Zeichenpunkte prüfen.';
    pointCount += stroke.points.length;
    if (pointCount > 30_000) return 'Die Zeichnung ist zu umfangreich. Bitte eine weitere Notiz anlegen.';
    if (stroke.points.some(point => !Array.isArray(point) || point.length !== 2 || !validCoordinate(point[0], 1000) || !validCoordinate(point[1], 600))) return 'Zeichenpunkte müssen innerhalb der Schreibfläche liegen.';
  }
  try {
    if (new TextEncoder().encode(JSON.stringify(content)).byteLength > 1_048_576) return 'Die Notiz ist zu groß. Bitte Inhalte auf mehrere Notizen verteilen.';
  } catch { return 'Die Notiz enthält ungültige Inhalte.'; }
  return null;
}

export function noteSearchText(draft: NoteDraft): string {
  return [draft.title, ...draft.tags, draft.content.text, draft.content.cues, draft.content.summary,
    ...draft.content.fields.flatMap(field => [field.label, field.value]),
    ...draft.content.tasks.flatMap(task => [task.text, task.assignee]),
    ...draft.content.sources.flatMap(source => [source.title, source.url]), ...draft.content.nodes.map(node => node.text)]
    .join(' ').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss').toLocaleLowerCase('de');
}
export function notePreview(draft: NoteDraft): string {
  const text = [draft.content.text, draft.content.summary,
    ...draft.content.fields.filter(field => field.value.trim()).map(field => `${field.label}: ${field.value}`),
    ...draft.content.tasks.map(task => task.text), ...draft.content.nodes.map(node => node.text),
    ...draft.content.sources.map(source => source.title || source.url), draft.content.cues]
    .find(value => value.trim())?.replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, 180) : draft.content.strokes.length ? 'Handschriftliche Notiz' : 'Noch kein Inhalt';
}
export function noteToDraft(record: OfficeNote): NoteDraft {
  return JSON.parse(JSON.stringify({ title: record.title, category: record.category, format: record.format, status: record.status,
    tags: record.tags, dueDate: record.dueDate, pinned: record.pinned, content: record.content })) as NoteDraft;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export function draftsEqual(a: NoteDraft, b: NoteDraft): boolean { return canonical(a) === canonical(b); }
