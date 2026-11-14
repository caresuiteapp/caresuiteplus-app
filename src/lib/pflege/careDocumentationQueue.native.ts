// Generated native presentation from src/lib/pflege/careDocumentationQueue.web.ts. Update through scripts/port-native-workspaces.mjs.
import { careDocumentationInstantMicros, type CareDocumentationKind, type CareDocumentationOriginal } from "./careDocumentationPacket.native.ts";
export const careDocumentationKindLabels: Readonly<Record<CareDocumentationKind, string>> = {
    care_report: 'Pflegebericht',
    planned_service: 'Geplante Leistung',
    refusal: 'Ablehnung',
    incident: 'Besonderes Ereignis',
    structured_protocol: 'Strukturiertes Protokoll',
    control: 'Kontrollauftrag',
    external: 'Fremddokumentation',
};
export type CareDocumentationQueueMode = 'all' | 'unconfirmed' | 'confirmed' | 'voided';
export type CareDocumentationDateRange = {
    from: string;
    to: string;
};
const berlinDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
});
const germanTime = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin', dateStyle: 'medium', timeStyle: 'short',
});
const normalize = (value: string) => value.toLocaleLowerCase('de-DE').replaceAll('ß', 'ss')
    .normalize('NFD').replace(/\p{M}/gu, '');
const searchTerms = (text: string) => normalize(text.trim()).split(/\s+/).filter(Boolean);
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && careDocumentationInstantMicros(`${value}T00:00:00Z`) !== null;
export function careDocumentationDateRangeIssue({ from, to }: CareDocumentationDateRange): string | null {
    if ((from && !validDate(from)) || (to && !validDate(to)))
        return 'Bitte ein gültiges Datum im Format JJJJ-MM-TT eingeben.';
    return from && to && from > to ? 'Das Anfangsdatum darf nicht nach dem Enddatum liegen.' : null;
}
export function careDocumentationBerlinDay(instant: string): string | null {
    const date = new Date(instant);
    if (!Number.isFinite(date.getTime()))
        return null;
    const parts = Object.fromEntries(berlinDate.formatToParts(date).map(({ type, value }) => [type, value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
}
export function careDocumentationDisplayTime(instant: string) {
    const date = new Date(instant);
    return Number.isFinite(date.getTime()) ? germanTime.format(date) : 'Zeitpunkt nicht lesbar';
}
export function matchesCareDocumentationName(term: string, firstName: string, lastName: string) {
    const name = normalize(`${firstName} ${lastName}`);
    return searchTerms(term).every(word => name.includes(word));
}
export function careDocumentationQueueState(row: CareDocumentationOriginal): Exclude<CareDocumentationQueueMode, 'all'> {
    if (row.voided)
        return 'voided';
    return row.signature && row.signature.contentFingerprint === row.contentFingerprint ? 'confirmed' : 'unconfirmed';
}
export function filterCareDocumentationQueue(rows: readonly CareDocumentationOriginal[], options: {
    mode: CareDocumentationQueueMode;
    kind: CareDocumentationKind | 'all';
    term: string;
    range: CareDocumentationDateRange;
}) {
    if (careDocumentationDateRangeIssue(options.range))
        return [];
    const terms = searchTerms(options.term);
    return rows.filter(row => {
        if (options.mode !== 'all' && careDocumentationQueueState(row) !== options.mode)
            return false;
        if (options.kind !== 'all' && row.kind !== options.kind)
            return false;
        if (options.range.from || options.range.to) {
            const day = careDocumentationBerlinDay(row.occurredAt);
            if (!day || (options.range.from && day < options.range.from) || (options.range.to && day > options.range.to))
                return false;
        }
        if (!terms.length)
            return true;
        const body = normalize([
            row.payload.title, row.payload.observation, row.payload.intervention, row.payload.result,
            row.recordedByName, careDocumentationKindLabels[row.kind],
        ].join('\n'));
        return terms.every(term => body.includes(term));
    });
}
