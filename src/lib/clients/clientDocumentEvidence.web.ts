import { woundInstant, woundUuid } from '../pflege/woundCareDomain.ts';

type Original = Record<string, unknown>;
export type ClientEvidenceField = { key: string; label: string; state: 'missing' | 'null' | 'empty' | 'invalid' | 'value'; raw: unknown; display: string };
export type ClientDocumentEvidenceRecord = { kind: 'contract' | 'consent' | 'document'; id: string; title: string; original: Original; fields: ClientEvidenceField[]; primary: ClientEvidenceField; hasRecordedSigningTime: boolean };
export type ClientDocumentEvidence = { tenantId: string; clientId: string; error: string | null; contracts: ClientDocumentEvidenceRecord[]; consents: ClientDocumentEvidenceRecord[]; documents: ClientDocumentEvidenceRecord[]; originalPools: { contracts: unknown; consents: unknown; documents: unknown } };
const object = (value: unknown): value is Original => !!value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function own(source: Original, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(source, key);
  if (!descriptor) return undefined;
  if (!('value' in descriptor) || !descriptor.enumerable) throw Error('Ein gelieferter Originalbestand enthält nicht eindeutig lesbare DTO-Felder.');
  return descriptor.value;
}
function validateOriginal(value: unknown, seen = new Set<object>()): void {
  if (value === null || value === undefined || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return;
  if ((!object(value) && !(Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype)) || seen.has(value as object)) throw Error('Ein gelieferter Originalbestand enthält ungeklärte oder nicht verlustfrei lesbare DTO-Werte.');
  seen.add(value as object);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (Array.isArray(value) && key === 'length') continue;
    if (typeof key !== 'string' || Array.isArray(value) && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length)) throw Error('Ein gelieferter Originalbestand enthält ungeklärte DTO-Schlüssel.');
    const descriptor = descriptors[key];
    if (!('value' in descriptor) || !descriptor.enumerable) throw Error('Ein gelieferter Originalbestand enthält nicht eindeutig lesbare DTO-Felder.');
    validateOriginal(descriptor.value, seen);
  }
  if (Array.isArray(value)) for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i)) throw Error('Ein gelieferter Originalbestand enthält eine lückenhafte DTO-Liste.');
  seen.delete(value as object);
}
const time = (value: unknown) => typeof value === 'string' && woundInstant(value.replace(' ', 'T')) !== null;
const date = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && woundInstant(`${value}T00:00:00Z`) !== null;
const workflow = new Set(['entwurf', 'aktiv', 'geplant', 'bestaetigt', 'in_bearbeitung', 'abgeschlossen', 'archiviert', 'fehlerhaft', 'gesperrt']);
type FieldKind = 'text' | 'time' | 'date' | 'dateOrTime' | 'flag' | 'id' | 'workflow' | 'positiveInteger';
function field(source: Original, key: string, label: string, kind: FieldKind = 'text'): ClientEvidenceField {
  if (!Object.hasOwn(source, key)) return { key, label, state: 'missing', raw: undefined, display: 'Im gelieferten Datensatz nicht enthalten' };
  const raw = structuredClone(source[key]);
  if (raw === null) return { key, label, state: 'null', raw, display: 'Nicht hinterlegt · Originalwert null' };
  if (typeof raw === 'string' && !raw.trim()) return { key, label, state: 'empty', raw, display: `Leerer Originaltext: ${JSON.stringify(raw)}` };
  const valid = kind === 'flag' ? typeof raw === 'boolean' : kind === 'time' ? time(raw) : kind === 'date' ? date(raw) : kind === 'dateOrTime' ? date(raw) || time(raw) : kind === 'id' ? woundUuid(raw) : kind === 'workflow' ? typeof raw === 'string' && workflow.has(raw) : kind === 'positiveInteger' ? Number.isInteger(raw) && Number(raw) >= 1 : typeof raw === 'string';
  if (!valid) return { key, label, state: 'invalid', raw, display: `Format ungeklärt · Original: ${JSON.stringify(raw)}` };
  return { key, label, state: 'value', raw, display: kind === 'flag' ? raw ? 'Als erteilt dokumentiert · Originalwert true' : 'Als nicht erteilt dokumentiert · Originalwert false' : String(raw) };
}
const metadata = (source: Original) => [field(source, 'createdAt', 'Erfasst · Originalzeit', 'time'), field(source, 'updatedAt', 'Hinterlegte Metadatenzeit · updatedAt', 'time')];
function project(source: Original, kind: ClientDocumentEvidenceRecord['kind']): ClientDocumentEvidenceRecord {
  const original = structuredClone(source);
  const titleField = field(source, kind === 'contract' ? 'contractNumber' : 'title', kind === 'contract' ? 'Vertragsnummer' : 'Titel');
  const title = titleField.state === 'value' ? (kind === 'contract' ? `Vertrag ${titleField.raw}` : titleField.raw as string) : `${kind === 'contract' ? 'Vertrag' : kind === 'consent' ? 'Einwilligung' : 'Dokument'} · ID ${source.id}`;
  let fields: ClientEvidenceField[], primary: ClientEvidenceField;
  if (kind === 'contract') {
    primary = field(source, 'signedAt', 'Hinterlegte Unterzeichnungsangabe · Originalzeit', 'time');
    fields = [titleField, field(source, 'contractPartner', 'Vertragspartner · Originalwert'), field(source, 'serviceBasis', 'Leistungsgrundlage · Originalwert'), field(source, 'contractVersion', 'Vertragsversion · Originalwert', 'positiveInteger'), primary, field(source, 'status', 'Vertragsstatus · Originalwert', 'workflow'), field(source, 'contractStart', 'Vertragsbeginn', 'date'), field(source, 'contractEnd', 'Vertragsende', 'date'), field(source, 'documentId', 'Hinterlegte Dokument-ID', 'id'), field(source, 'notes', 'Vertragshinweis'), ...metadata(source)];
  } else if (kind === 'consent') {
    primary = field(source, 'granted', 'Hinterlegte Einwilligungsentscheidung', 'flag');
    fields = [titleField, primary, field(source, 'consentType', 'Einwilligungsart · Originalwert'), field(source, 'scope', 'Hinterlegter Umfang · Originalwert'), field(source, 'grantedAt', 'Erteilungszeit · Originalangabe, keine Unterzeichnung', 'time'), field(source, 'expiresAt', 'Hinterlegter Ablaufzeitpunkt', 'time'), field(source, 'grantedByProfileId', 'Hinterlegte entscheidende Profil-ID', 'id'), field(source, 'documentId', 'Hinterlegte Dokument-ID', 'id'), field(source, 'notes', 'Einwilligungshinweis'), ...metadata(source)];
  } else {
    primary = field(source, 'status', 'Dokumentenstatus · Originalwert', 'workflow');
    fields = [titleField, primary, field(source, 'fileName', 'Dateiname'), field(source, 'category', 'Dokumentkategorie · Originalwert'), field(source, 'documentSource', 'Hinterlegte Dokumentherkunft'), field(source, 'intakeStatus', 'Aufnahmeworkflow · Originalwert'), field(source, 'intakeDocumentId', 'Zugeordnete Aufnahme-Dokument-ID', 'id'), field(source, 'uploadedBy', 'Hinterlegte Upload-Profil-ID', 'id'), field(source, 'validUntil', 'Hinterlegtes Gültigkeitsende', 'dateOrTime'), ...metadata(source)];
  }
  return { kind, id: source.id as string, title, original, fields, primary, hasRecordedSigningTime: kind === 'contract' && primary.state === 'value' };
}

/** Only the entire actually supplied DTO collections. No backend completeness, signature authentication, consent validity or permission claim. */
export function captureClientDocumentEvidence(input: unknown, scope: { tenantId: string; clientId: string }): ClientDocumentEvidence {
  const result: ClientDocumentEvidence = { tenantId: scope?.tenantId ?? '', clientId: scope?.clientId ?? '', error: null, contracts: [], consents: [], documents: [], originalPools: { contracts: undefined, consents: undefined, documents: undefined } };
  try {
    if (!scope || !woundUuid(scope.tenantId) || !woundUuid(scope.clientId) || !object(input) || !Object.hasOwn(input, 'tenantId') || own(input, 'tenantId') !== scope.tenantId || !Object.hasOwn(input, 'id') || own(input, 'id') !== scope.clientId) throw Error('Der eigene Mandanten- und Klientenbezug dieser Belegangaben ist nicht bestätigt.');
    const names = ['contracts', 'consents', 'documents'] as const;
    for (const name of names) if (Object.hasOwn(input, name)) { const pool = own(input, name); validateOriginal(pool); result.originalPools[name] = structuredClone(pool); }
    for (const name of names) {
      if (!Object.hasOwn(input, name) || !Array.isArray(input[name])) throw Error(`Der ganze gelieferte Bestand „${name}“ fehlt oder hat ein ungeklärtes Format. Keine Teilbestätigung der Belege.`);
      const pool = input[name] as unknown[], ids = new Set<string>();
      for (let i = 0; i < pool.length; i++) {
        const row = pool[i];
        if (!Object.hasOwn(pool, i) || !object(row) || !Object.hasOwn(row, 'id') || !woundUuid(row.id) || ids.has(row.id.toLowerCase()) || !Object.hasOwn(row, 'tenantId') || row.tenantId !== scope.tenantId || !Object.hasOwn(row, 'clientId') || row.clientId !== scope.clientId) throw Error('Die ganzen gelieferten Belegbestände enthalten ungültige, fremde oder doppelte native Zuordnungen. Keine Teilbestätigung.');
        ids.add(row.id.toLowerCase());
      }
    }
    result.contracts = (input.contracts as Original[]).map(row => project(row, 'contract'));
    result.consents = (input.consents as Original[]).map(row => project(row, 'consent'));
    result.documents = (input.documents as Original[]).map(row => project(row, 'document'));
    return result;
  } catch (cause) { result.error = cause instanceof Error ? cause.message : 'Belegangaben konnten nicht vollständig gelesen werden.'; result.contracts = []; result.consents = []; result.documents = []; return result; }
}
