// Generated native presentation from src/lib/clients/clientRecordDates.web.ts. Update through scripts/port-native-workspaces.mjs.
import { woundInstant, woundUuid } from '../pflege/woundCareDomain.ts';
import type { ClientEvidenceField } from "./clientDocumentEvidence.native.ts";
export type ClientRecordDates = {
    tenantId: string;
    clientId: string;
    error: string | null;
    admission: ClientEvidenceField;
    creation: ClientEvidenceField;
};
type Original = Record<string, unknown>;
const object = (v: unknown): v is Original => !!v && typeof v === 'object' && !Array.isArray(v) && [Object.prototype, null].includes(Object.getPrototypeOf(v));
function own(source: Original, key: string) { const descriptor = Object.getOwnPropertyDescriptor(source, key); if (!descriptor)
    return undefined; if (!('value' in descriptor) || !descriptor.enumerable)
    throw Error('Datumsangabe ist nicht als eigenes natives DTO-Feld lesbar.'); return descriptor.value; }
function cloneOriginal(v: unknown, seen = new Set<object>()): unknown {
    if (v === null || v === undefined || typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number' && Number.isFinite(v))
        return v;
    if ((!object(v) && !Array.isArray(v)) || seen.has(v as object))
        throw Error('Originale Datumsangabe ist nicht verlustfrei lesbar.');
    seen.add(v as object);
    const out: Original | unknown[] = Array.isArray(v) ? [] : {};
    if (Array.isArray(v) && Object.getPrototypeOf(v) !== Array.prototype)
        throw Error('Originale Datumsangabe ist kein natives Array.');
    const descriptors = Object.getOwnPropertyDescriptors(v);
    for (const key of Reflect.ownKeys(descriptors)) {
        if (Array.isArray(v) && key === 'length')
            continue;
        if (typeof key !== 'string')
            throw Error('Originale Datumsangabe enthält ungeklärte DTO-Felder.');
        const d = descriptors[key];
        if (!('value' in d) || !d.enumerable || Array.isArray(v) && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= v.length))
            throw Error('Originale Datumsangabe enthält ungeklärte DTO-Felder.');
        Object.defineProperty(out, key, { value: cloneOriginal(d.value, seen), enumerable: true, writable: true, configurable: true });
    }
    if (Array.isArray(v))
        for (let i = 0; i < v.length; i++)
            if (!Object.hasOwn(v, i))
                throw Error('Originale Datumsangabe enthält fehlende Arraypositionen.');
    seen.delete(v as object);
    return out;
}
const date = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && woundInstant(`${v}T00:00:00Z`) !== null;
const time = (v: unknown) => typeof v === 'string' && woundInstant(v.replace(' ', 'T')) !== null;
function field(input: Original, key: string, label: string, kind: 'date' | 'time'): ClientEvidenceField {
    if (!Object.hasOwn(input, key))
        return { key, label, state: 'missing', raw: undefined, display: 'Nicht im gelieferten Datensatz enthalten · Zeitpunkt nicht bestätigt' };
    const raw = cloneOriginal(own(input, key));
    if (raw === null)
        return { key, label, state: 'null', raw, display: 'Nicht hinterlegt · Originalwert null' };
    if (typeof raw === 'string' && !raw.trim())
        return { key, label, state: 'empty', raw, display: `Nicht bestätigt · leerer Originaltext ${JSON.stringify(raw)}` };
    if (!(kind === 'date' ? date(raw) : time(raw)))
        return { key, label, state: 'invalid', raw, display: `Format ungeklärt · Original: ${raw === undefined ? 'undefined' : JSON.stringify(raw)}` };
    return { key, label, state: 'value', raw, display: raw as string };
}
/** Web read-only DTO evidence: a DATE is never supplied from creation metadata, service/plan time, tasks or a status hint. No actual admission/release is inferred. */
export function captureClientRecordDates(input: unknown, scope: {
    tenantId: string;
    clientId: string;
}): ClientRecordDates {
    const unknown = (key: string, label: string): ClientEvidenceField => ({ key, label, state: 'invalid', raw: undefined, display: 'Eigener Datumsbezug nicht bestätigt' });
    const result: ClientRecordDates = { tenantId: scope?.tenantId ?? '', clientId: scope?.clientId ?? '', error: null, admission: unknown('admissionDate', 'Gespeichertes Aufnahmedatum · DATE'), creation: unknown('createdAt', 'Aktenerstellung · Metadatum, kein Aufnahmebeginn') };
    try {
        if (!scope || !woundUuid(scope.tenantId) || !woundUuid(scope.clientId) || !object(input) || !Object.hasOwn(input, 'id') || !Object.hasOwn(input, 'tenantId') || own(input, 'id') !== scope.clientId || own(input, 'tenantId') !== scope.tenantId)
            throw Error('Eigener nativer Mandanten- und Klientenbezug der Datumsangaben fehlt.');
        result.admission = field(input, 'admissionDate', result.admission.label, 'date');
        result.creation = field(input, 'createdAt', result.creation.label, 'time');
        return result;
    }
    catch (e) {
        result.error = e instanceof Error ? e.message : 'Datumsangaben nicht eindeutig lesbar.';
        result.admission = unknown('admissionDate', result.admission.label);
        result.creation = unknown('createdAt', result.creation.label);
        return result;
    }
}
