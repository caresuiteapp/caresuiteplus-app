import { validEventInstant } from './medicationAdministrationDomain.ts';
import { medicationTimeDisplay } from './medicationTimeDisplay.web.ts';
import { woundUuid } from './woundCareDomain.ts';

type Original = Record<string, unknown>;
export type HistoricalMedicationScope = { tenantId: string; medicationId: string; clientId: string };
export type HistoricalMedicationField = { key: string; label: string; state: 'missing' | 'null' | 'empty' | 'value' | 'invalid'; raw: unknown; display: string };
export type HistoricalMedicationPlan = {
  eventId: string;
  snapshotState: 'missing' | 'null' | 'empty' | 'invalid' | 'recorded';
  message: string;
  ownSnapshot: boolean;
  originalEvent: Original;
  originalSnapshot: unknown;
  planTime: HistoricalMedicationField;
  actualTime: HistoricalMedicationField;
  version: HistoricalMedicationField | null;
  fields: HistoricalMedicationField[];
};
export type HistoricalMedicationHistory = { error: string | null; entries: HistoricalMedicationPlan[] };
const object = (v: unknown): v is Original => !!v && typeof v === 'object' && !Array.isArray(v);
const metadataTime = (v: unknown): v is string => typeof v === 'string' && validEventInstant(v.replace(' ', 'T'));
const calendar = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && validEventInstant(`${v}T00:00:00Z`);
const definitions: Array<[string, string, 'text' | 'date' | 'flag']> = [
  ['name', 'Präparat im gespeicherten Original', 'text'], ['active_ingredient', 'Wirkstoff', 'text'], ['strength', 'Stärke', 'text'], ['form', 'Form', 'text'],
  ['dosage', 'Gespeicherte Dosierung', 'text'], ['route', 'Gespeicherte Applikation', 'text'], ['schedule', 'Gespeicherter Gabeplan / Häufigkeit', 'text'],
  ['morning_dose', 'Morgens im gespeicherten Plan', 'text'], ['noon_dose', 'Mittags im gespeicherten Plan', 'text'], ['evening_dose', 'Abends im gespeicherten Plan', 'text'], ['night_dose', 'Nachts im gespeicherten Plan', 'text'],
  ['is_prn', 'Bedarfskennzeichnung im Original', 'flag'], ['prn_reason', 'Gespeicherte Bedarfsbedingung', 'text'], ['indication', 'Gespeicherte Indikation', 'text'],
  ['start_date', 'Gespeicherter Gültigkeitsbeginn', 'date'], ['end_date', 'Gespeichertes Gültigkeitsende', 'date'], ['prescribed_by', 'Verordnende Person im Original', 'text'],
  ['notes', 'Gespeicherte Anweisungen / Hinweise', 'text'], ['interaction_notes', 'Wechselwirkungshinweis im Original', 'text'], ['side_effect_notes', 'Nebenwirkungs- / Überwachungshinweis im Original', 'text'], ['storage_notes', 'Lagerungshinweis im Original', 'text'],
];
function field(source: Original, key: string, label: string, kind: 'text' | 'date' | 'flag' | 'time' | 'actual'): HistoricalMedicationField {
  const raw = Object.hasOwn(source, key) ? structuredClone(source[key]) : undefined;
  if (!Object.hasOwn(source, key)) return { key, label, raw, state: 'missing', display: 'Im gelieferten Original nicht enthalten' };
  if (raw === null) return { key, label, raw, state: 'null', display: 'Nicht angegeben · Originalwert null' };
  if (typeof raw === 'string' && !raw.trim()) return { key, label, raw, state: 'empty', display: `Leerer Originaltext: ${JSON.stringify(raw)}` };
  const valid = kind === 'flag' ? typeof raw === 'boolean' : kind === 'time' ? metadataTime(raw) : kind === 'actual' ? typeof raw === 'string' && validEventInstant(raw) : kind === 'date' ? calendar(raw) : typeof raw === 'string';
  if (!valid) return { key, label, raw, state: 'invalid', display: `Originalformat nicht bestätigt · Original: ${JSON.stringify(raw)} · vollständigen Beleg prüfen` };
  return { key, label, raw, state: 'value', display: kind === 'time' || kind === 'actual' ? medicationTimeDisplay(raw as string).display : kind === 'flag' ? raw ? 'Ja · Originalwert true' : 'Nein · Originalwert false' : raw as string };
}
function capturePlan(event: Original): HistoricalMedicationPlan {
  const originalEvent = structuredClone(event), originalSnapshot = Object.hasOwn(event, 'orderSnapshot') ? structuredClone(event.orderSnapshot) : undefined;
  const common = { eventId: event.id as string, originalEvent, originalSnapshot,
    planTime: field(event, 'scheduledAt', 'Separat dokumentierter Plantermin', 'time'),
    actualTime: field(event, 'occurredAt', 'Originalangabe zum tatsächlichen Ereigniszeitpunkt', 'actual'), version: null, fields: [] };
  if (!Object.hasOwn(event, 'orderSnapshot')) return { ...common, snapshotState: 'missing', ownSnapshot: false, message: 'Ein Verordnungsoriginal ist im gelieferten Ereignis nicht enthalten.' };
  if (event.orderSnapshot === null) return { ...common, snapshotState: 'null', ownSnapshot: false, message: 'Für dieses Ereignis ist kein Verordnungsoriginal gespeichert (Originalwert null).' };
  if (object(event.orderSnapshot) && Object.keys(event.orderSnapshot).length === 0) return { ...common, snapshotState: 'empty', ownSnapshot: false, message: 'Das gespeicherte Verordnungsoriginal ist ein leeres Objekt. Eine damalige Grundlage ist damit nicht bestätigt.' };
  const snapshot = event.orderSnapshot;
  if (!object(snapshot) || ['id', 'tenant_id', 'client_id'].some(key => !Object.hasOwn(snapshot, key))
    || snapshot.id !== event.medicationId || snapshot.tenant_id !== event.tenantId || snapshot.client_id !== event.clientId) {
    return { ...common, snapshotState: 'invalid', ownSnapshot: false, message: 'Das historische Verordnungsoriginal ist dem nativen Medikament, Mandanten und Pflegefall nicht eindeutig zugeordnet. Kein Ersatz durch den aktuellen Plan.' };
  }
  const version = field(snapshot, 'updated_at', 'Verordnungsstand dieses Originalbelegs', 'time');
  const fields = definitions.map(([key, label, kind]) => field(snapshot, key, label, kind));
  const invalid = version.state !== 'value' || fields.some(value => value.state === 'invalid');
  return { ...common, version, fields, ownSnapshot: true, snapshotState: invalid ? 'invalid' : 'recorded',
    message: invalid ? 'Der eigene historische Originalbeleg enthält ungeklärte Format- oder Versionsangaben. Er bestätigt keine gültige Planfassung.' : 'Bei dieser Dokumentation gespeicherter Verordnungsbeleg. Das bestätigt weder die ärztliche Freigabe noch die Wirksamkeit dieser Fassung zum tatsächlichen Ereigniszeitpunkt.' };
}

/** Inspect the entire supplied native history before a view cuts it down. Never replace a missing historical snapshot or a planned time with current data. */
export function captureHistoricalMedicationPlans(input: unknown, scope: HistoricalMedicationScope): HistoricalMedicationHistory {
  try {
    if (!scope || ![scope.tenantId, scope.medicationId, scope.clientId].every(woundUuid) || !Array.isArray(input)) throw Error('Der ganze native Ereignisbestand für historische Verordnungsbelege ist nicht bestätigt.');
    const ids = new Set<string>();
    for (let i = 0; i < input.length; i++) {
      const event = input[i];
      if (!Object.hasOwn(input, i) || !object(event) || !Object.hasOwn(event, 'id') || !woundUuid(event.id) || ids.has(event.id.toLowerCase())
        || !Object.hasOwn(event, 'tenantId') || event.tenantId !== scope.tenantId || !Object.hasOwn(event, 'medicationId') || event.medicationId !== scope.medicationId
        || !Object.hasOwn(event, 'clientId') || event.clientId !== scope.clientId) throw Error('Der ganze historische Ereignisbestand enthält ungültige, fremde oder doppelte native Zuordnungen. Keine Teilbestätigung der Planbelege.');
      ids.add(event.id.toLowerCase());
    }
    return { error: null, entries: input.map(capturePlan) };
  } catch (cause) { return { error: cause instanceof Error ? cause.message : 'Historische Originalbelege konnten nicht vollständig geprüft werden.', entries: [] }; }
}
