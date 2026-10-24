// Generated native presentation from src/lib/clients/clientRecordAppointmentEvidence.web.ts. Update through scripts/port-native-workspaces.mjs.
import { woundUuid } from '../pflege/woundCareDomain.ts';
import type { ClientEvidenceField } from "./clientDocumentEvidence.native.ts";
type Original = Record<string, unknown>;
type SuppliedOriginal = {
    present: boolean;
    raw: unknown;
};
export type ClientRecordAppointmentEvidence = {
    tenantId: string;
    clientId: string;
    error: string | null;
    details: 'not-supplied' | 'unconfirmed';
    appointmentDisplay: string;
    hint: ClientEvidenceField;
    originals: {
        nextActionHint: SuppliedOriginal;
        contextCounts: SuppliedOriginal;
    };
};
const object = (value: unknown): value is Original => !!value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function own(source: Original, key: string): unknown {
    const descriptor = Object.getOwnPropertyDescriptor(source, key);
    if (!descriptor)
        return undefined;
    if (!('value' in descriptor) || !descriptor.enumerable)
        throw Error('Gelieferter Hinweis ist nicht als eigenes natives DTO-Feld lesbar.');
    return descriptor.value;
}
function cloneOriginal(value: unknown, seen = new Set<object>()): unknown {
    if (value === null || value === undefined || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value))
        return value;
    if ((!object(value) && !(Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype)) || seen.has(value as object))
        throw Error('Gelieferte Hinweis-Metadaten sind nicht verlustfrei lesbar.');
    seen.add(value as object);
    const result: Original | unknown[] = Array.isArray(value) ? [] : {};
    for (const key of Reflect.ownKeys(value as object)) {
        if (Array.isArray(value) && key === 'length')
            continue;
        const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
        if (typeof key !== 'string' || !('value' in descriptor) || !descriptor.enumerable || Array.isArray(value) && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length))
            throw Error('Gelieferte Hinweis-Metadaten enthalten ungeklärte DTO-Felder.');
        Object.defineProperty(result, key, { value: cloneOriginal(descriptor.value, seen), enumerable: true, writable: true, configurable: true });
    }
    if (Array.isArray(value))
        for (let i = 0; i < value.length; i++)
            if (!Object.hasOwn(value, i))
                throw Error('Gelieferte Hinweis-Metadaten enthalten fehlende Arraypositionen.');
    seen.delete(value as object);
    return result;
}
const unknownHint = (): ClientEvidenceField => ({ key: 'nextActionHint', label: 'Unbestätigter Status-/Arbeitshinweis · Originalangabe', state: 'invalid', raw: undefined, display: 'Eigener Hinweisbezug nicht bestätigt' });
function hintField(original: SuppliedOriginal): ClientEvidenceField {
    const base = unknownHint(), raw = cloneOriginal(original.raw);
    if (!original.present)
        return { ...base, state: 'missing', raw, display: 'Nicht im gelieferten Datensatz enthalten' };
    if (raw === null)
        return { ...base, state: 'null', raw, display: 'Nicht hinterlegt · Originalwert null' };
    if (typeof raw === 'string')
        return !raw.trim() ? { ...base, state: 'empty', raw, display: `Leerer Originaltext: ${JSON.stringify(raw)}` } : { ...base, state: 'value', raw, display: raw };
    // Unexpected compound values remain intact internally; do not expose their potentially unrelated clinical content.
    return { ...base, state: 'invalid', raw, display: `Hinweisformat ungeklärt · Originaltyp ${raw === undefined ? 'undefined' : Array.isArray(raw) ? 'Array' : typeof raw}` };
}
/** The supplied ClientFullDetail has no dated appointment DTO. A status hint, summary count, task or timestamp cannot supply it. */
export function captureClientRecordAppointmentEvidence(input: unknown, scope: {
    tenantId: string;
    clientId: string;
}): ClientRecordAppointmentEvidence {
    const result: ClientRecordAppointmentEvidence = {
        tenantId: scope?.tenantId ?? '', clientId: scope?.clientId ?? '', error: null,
        details: 'not-supplied', appointmentDisplay: 'Kein datierter Termin im gelieferten Aktenbestand', hint: unknownHint(),
        originals: { nextActionHint: { present: false, raw: undefined }, contextCounts: { present: false, raw: undefined } },
    };
    try {
        if (!scope || !woundUuid(scope.tenantId) || !woundUuid(scope.clientId) || !object(input) || !Object.hasOwn(input, 'id') || !Object.hasOwn(input, 'tenantId') || own(input, 'id') !== scope.clientId || own(input, 'tenantId') !== scope.tenantId)
            throw Error('Eigener nativer Mandanten- und Klientenbezug der Hinweisangaben fehlt.');
        for (const key of ['nextActionHint', 'contextCounts'] as const)
            result.originals[key] = { present: Object.hasOwn(input, key), raw: cloneOriginal(own(input, key)) };
        result.hint = hintField(result.originals.nextActionHint);
        return result;
    }
    catch (cause) {
        result.error = cause instanceof Error ? cause.message : 'Hinweisangaben nicht eindeutig lesbar.';
        result.details = 'unconfirmed';
        result.appointmentDisplay = 'Eigene Terminangaben nicht bestätigt';
        result.hint = unknownHint();
        return result;
    }
}
