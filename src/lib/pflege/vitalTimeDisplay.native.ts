// Generated native presentation from src/lib/pflege/vitalTimeDisplay.web.ts. Update through scripts/port-native-workspaces.mjs.
import { validEventInstant } from './medicationAdministrationDomain.ts';
import { medicationTimeDisplay } from "./medicationTimeDisplay.native.ts";
import { woundInstant } from './woundCareDomain.ts';
export type VitalTimeDisplay = Readonly<{
    state: 'valid' | 'missing' | 'undefined' | 'null' | 'empty' | 'invalid' | 'unreadable';
    raw: string | null | undefined;
    display: string;
}>;
type TimeField = 'occurredAt' | 'recordedAt' | 'observedAt' | 'nextReviewAt';
/** A structural original-time projection, never proof of clinical performance.
 * Historical native READ values may use a space; the original is not changed.
 * The existing new-write grammar and all Original DTOs remain untouched. */
export function vitalTimeDisplay(value: unknown): VitalTimeDisplay {
    if (value === undefined)
        return { state: 'undefined', raw: undefined, display: 'Nicht bestätigt – Originalzeit ist undefiniert' };
    if (value === null)
        return { state: 'null', raw: null, display: 'Nicht bestätigt – keine Originalzeit hinterlegt' };
    if (value === '')
        return { state: 'empty', raw: '', display: 'Nicht bestätigt – Originalzeit ist leer' };
    if (typeof value !== 'string')
        return { state: 'invalid', raw: undefined, display: 'Nicht bestätigt – Originalzeit hat kein Zeitstempelformat' };
    // Check the exact original calendar/zone/precision before Intl can normalize it.
    // Only a temporary read representation is used; no trim or date-only fallback.
    if (!validEventInstant(value.replace(' ', 'T')))
        return { state: 'invalid', raw: value, display: `Ungültige Originalzeit – nicht bestätigt · Original: ${JSON.stringify(value)}` };
    return { state: 'valid', raw: value, display: medicationTimeDisplay(value).display };
}
/** Read only this own timestamp data property. This is not a whole-DTO or
 * native scope/author/complete-history validation. Accessors are never invoked. */
export function vitalTimeFieldDisplay(record: unknown, field: TimeField): VitalTimeDisplay {
    try {
        if (!record || typeof record !== 'object' || Array.isArray(record)
            || ![Object.prototype, null].includes(Object.getPrototypeOf(record))) {
            return { state: 'unreadable', raw: undefined, display: 'Nicht bestätigt – Originalzeitquelle ist ungeklärt' };
        }
        const descriptor = Object.getOwnPropertyDescriptor(record, field);
        if (!descriptor)
            return { state: 'missing', raw: undefined, display: 'Nicht bestätigt – Originalzeit wurde nicht geliefert' };
        if (!('value' in descriptor) || !descriptor.enumerable)
            return { state: 'unreadable', raw: undefined, display: 'Nicht bestätigt – Originalzeit ist nicht als eigener Rohwert bestätigt' };
        return vitalTimeDisplay(descriptor.value);
    }
    catch {
        return { state: 'unreadable', raw: undefined, display: 'Nicht bestätigt – Originalzeitquelle ist nicht lesbar' };
    }
}
/** Only a valid stored actual-time field permits the first new Web follow-up.
 * This grants no rights and is deliberately irrelevant to an opaque retry. */
export function validVitalActualTimeField(record: unknown): boolean {
    return vitalTimeFieldDisplay(record, 'occurredAt').state === 'valid';
}
/** Exact native READ precision is a lower bound for a first new control.
 * Date.parse alone would conflate instants within the same millisecond.
 * Original retries never consult this new-payload check. */
export function vitalFollowUpChronologyError(record: unknown, observedAt: unknown): string | null {
    const head = vitalTimeFieldDisplay(record, 'occurredAt');
    if (head.state !== 'valid' || typeof head.raw !== 'string')
        return 'Der tatsächliche Messzeitpunkt ist nicht bestätigt. Messung erneut prüfen; keine neue Folgedokumentation anlegen.';
    const actual = woundInstant(head.raw.replace(' ', 'T'));
    const observed = typeof observedAt === 'string' ? woundInstant(observedAt) : null;
    if (actual === null || observed === null)
        return 'Tatsächlichen Kontrollzeitpunkt mit Zeitzone prüfen.';
    if (observed < actual)
        return 'Der Kontrollzeitpunkt darf nicht vor dem ursprünglichen tatsächlichen Messzeitpunkt liegen.';
    return null;
}
