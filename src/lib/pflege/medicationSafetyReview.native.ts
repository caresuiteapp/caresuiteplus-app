// Generated native presentation from src/lib/pflege/medicationSafetyReview.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { medicationSafetyOriginalIssue, type MedicationSafetyKind, type MedicationSafetyOriginal } from "./medicationSafetyPacket.native.ts";
export type MedicationSafetyReviewQualification = Readonly<{
    id: string;
    employeeId: string;
    profileId: string;
    qualificationType: string;
    title: string;
    status: 'valid' | 'expires_soon';
    issuedAt: string | null;
    validUntil: string | null;
    verifiedAt: string;
    updatedAt: string;
    documentId: string;
    documentFingerprint: string;
    sourceFingerprint: string;
    employmentStart: string;
    employmentEnd: string | null;
    employeeFingerprint: string;
    scopeId: string;
    scopeKind: MedicationSafetyKind;
    scopeFingerprint: string;
}>;
export type MedicationSafetyReviewEvent = Readonly<{
    id: string;
    revision: number;
    previousId: string | null;
    requestId: string;
    action: 'request' | 'return' | 'accept';
    recordedAt: string;
    actorId: string;
    actorName: string;
    reason: string;
    requiredChange: string;
    rationale: string;
    medicationHeadId: string;
    medicationFingerprint: string;
    qualification: MedicationSafetyReviewQualification | null;
    fingerprint: string;
}>;
export type MedicationSafetyReviewOriginal = Readonly<{
    id: string;
    tenantId: string;
    clientId: string;
    medicationId: string;
    rootId: string;
    headId: string;
    revision: number;
    medicationRootId: string;
    medicationHeadId: string;
    medicationFingerprint: string;
    medicationKind: MedicationSafetyKind;
    status: 'requested' | 'returned' | 'accepted';
    history: readonly MedicationSafetyReviewEvent[];
}>;
export type MedicationSafetyReviewPacket = Readonly<{
    schemaVersion: '1';
    action: 'request' | 'return' | 'accept';
    requestId: string;
    tenantId: string;
    clientId: string;
    medicationId: string;
    actorId: string;
    expectedHeadId: string | null;
    expectedRevision: number;
    medicationOriginal: MedicationSafetyOriginal;
    reviewOriginal: MedicationSafetyReviewOriginal | null;
    reason: string;
    requiredChange: string;
    rationale: string;
}>;
const kinds = new Set<MedicationSafetyKind>(['reconciliation', 'order_capture', 'schedule_version', 'administration', 'late_administration', 'non_administration', 'prn_administration', 'effect_review', 'safety_signal', 'controlled_witness', 'preparation_stock', 'order_pause_stop', 'prn_interval_check', 'maximum_dose_check', 'controlled_ledger', 'correction']);
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const sha = (v: unknown): v is string => typeof v === 'string' && /^sha256:[0-9a-f]{64}$/.test(v);
const text = (v: unknown, min = 0, max = 8000): v is string => typeof v === 'string' && v.trim().length >= min && v.length <= max;
const clone = <T>(v: T): T => structuredClone(v);
export const medicationReviewStable = (v: unknown): string => JSON.stringify(v, (_key, item: unknown) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, (item as Record<string, unknown>)[key]])) : item);
export function medicationReviewInstantMicros(v: unknown): bigint | null {
    if (typeof v !== 'string')
        return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:?\d{2})$/.exec(v);
    if (!m || Number(m[1]) < 1000 || Number(m[4]) > 23 || Number(m[5]) > 59 || Number(m[6]) > 59)
        return null;
    const day = `${m[1]}-${m[2]}-${m[3]}`, parsedDay = Date.parse(`${day}T00:00:00Z`);
    if (!Number.isFinite(parsedDay) || new Date(parsedDay).toISOString().slice(0, 10) !== day)
        return null;
    if (m[8] !== 'Z') {
        const zone = m[8].replace(':', '');
        if (Number(zone.slice(1, 3)) > 14 || Number(zone.slice(3)) > 59 || Number(zone.slice(1, 3)) === 14 && Number(zone.slice(3)) !== 0)
            return null;
    }
    const whole = Date.parse(`${day}T${m[4]}:${m[5]}:${m[6]}${m[8]}`);
    return Number.isFinite(whole) ? BigInt(whole) * 1000n + BigInt((m[7] ?? '').padEnd(6, '0')) : null;
}
const calendarDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && medicationReviewInstantMicros(`${v}T00:00:00Z`) !== null;
const berlinDay = (at: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at));
function qualificationIssue(q: MedicationSafetyReviewQualification | null, actor: string, kind: MedicationSafetyKind, at: string): string | null {
    if (!q || ![q.id, q.employeeId, q.profileId, q.documentId, q.scopeId].every(uuid) || q.profileId !== actor || q.scopeKind !== kind || !text(q.qualificationType, 1, 200) || !text(q.title, 1, 500) || !['valid', 'expires_soon'].includes(q.status) || ![q.documentFingerprint, q.sourceFingerprint, q.employeeFingerprint, q.scopeFingerprint].every(sha) || !calendarDate(q.employmentStart) || q.employmentEnd !== null && !calendarDate(q.employmentEnd) || q.issuedAt !== null && !calendarDate(q.issuedAt) || q.validUntil !== null && !calendarDate(q.validUntil))
        return 'Vollständige Beschäftigungs-, Qualifikations-, Dokument- und Prüfbereichsoriginale fehlen.';
    const verified = medicationReviewInstantMicros(q.verifiedAt), updated = medicationReviewInstantMicros(q.updatedAt), recorded = medicationReviewInstantMicros(at);
    if (verified === null || updated === null || recorded === null || verified > recorded || updated > recorded)
        return 'Qualifikation war zum Prüfzeitpunkt nicht verifiziert.';
    const day = berlinDay(at);
    return q.employmentStart > day || q.employmentEnd !== null && q.employmentEnd < day || q.issuedAt !== null && q.issuedAt > day || q.validUntil !== null && q.validUntil < day ? 'Beschäftigung oder Qualifikation gilt am Prüftag nicht.' : null;
}
export function medicationSafetyReviewOriginalIssue(v: unknown, c: {
    tenantId: string;
    clientId: string;
    medicationId: string;
}): string | null {
    const o = v as MedicationSafetyReviewOriginal;
    if (!o || ![o.id, o.rootId, o.headId, o.medicationRootId, o.medicationHeadId].every(uuid) || o.tenantId !== c.tenantId || o.clientId !== c.clientId || o.medicationId !== c.medicationId || !kinds.has(o.medicationKind) || !sha(o.medicationFingerprint) || ![1, 2].includes(o.revision) || !Array.isArray(o.history) || o.history.length !== o.revision)
        return 'Vollständiges Medikationsprüforiginal fehlt.';
    const ids = new Set<string>(), requests = new Set<string>();
    for (let i = 0; i < o.history.length; i++) {
        const e = o.history[i], prior = i ? o.history[i - 1] : null;
        if (!e || ![e.id, e.requestId, e.actorId, e.medicationHeadId].every(uuid) || ids.has(e.id) || requests.has(e.requestId) || e.revision !== i + 1 || e.previousId !== (prior?.id ?? null) || e.medicationHeadId !== o.medicationHeadId || e.medicationFingerprint !== o.medicationFingerprint || medicationReviewInstantMicros(e.recordedAt) === null || !text(e.actorName, 1, 500) || !sha(e.fingerprint))
            return 'Medikationsprüfhistorie ist abgeschnitten, doppelt oder an eine andere Fassung gebunden.';
        if (!i) {
            if (e.action !== 'request' || !text(e.reason, 10, 2000) || e.requiredChange !== '' || e.rationale !== '' || e.qualification !== null)
                return 'Medikationsprüfanfrage enthält eine unzulässige Entscheidung.';
        }
        else {
            if (prior!.action !== 'request' || e.actorId === prior!.actorId || medicationReviewInstantMicros(e.recordedAt)! < medicationReviewInstantMicros(prior!.recordedAt)!)
                return 'Prüfentscheidung benötigt eine zeitlich nachfolgende getrennte Person.';
            const issue = qualificationIssue(e.qualification, e.actorId, o.medicationKind, e.recordedAt);
            if (issue)
                return issue;
            if (e.action === 'return') {
                if (!text(e.reason, 10, 2000) || !text(e.requiredChange, 10, 4000) || e.rationale !== '')
                    return 'Begründete Rückgabe ist unvollständig.';
            }
            else if (e.action !== 'accept' || e.reason !== '' || e.requiredChange !== '' || !text(e.rationale, 10, 4000))
                return 'Qualifizierte Annahme ist unvollständig.';
        }
        ids.add(e.id);
        requests.add(e.requestId);
    }
    const first = o.history[0], last = o.history.at(-1)!;
    return first.id !== o.rootId || o.id !== o.headId || last.id !== o.headId || o.status !== (last.action === 'request' ? 'requested' : last.action === 'return' ? 'returned' : last.action === 'accept' ? 'accepted' : null) ? 'Prüfkopf stimmt nicht mit der vollständigen Medikationsprüfhistorie überein.' : null;
}
export function medicationSafetyReviewPacketIssue(v: unknown): string | null {
    const p = v as MedicationSafetyReviewPacket;
    if (!p || p.schemaVersion !== '1' || !['request', 'return', 'accept'].includes(p.action) || ![p.requestId, p.tenantId, p.clientId, p.medicationId, p.actorId].every(uuid) || !Number.isSafeInteger(p.expectedRevision) || p.expectedRevision < 0)
        return 'Medikationsprüfanfrage ist nicht vollständig gebunden.';
    const issue = medicationSafetyOriginalIssue(p.medicationOriginal, { tenantId: p.tenantId, clientId: p.clientId, medicationId: p.medicationId });
    if (issue)
        return issue;
    const care = p.medicationOriginal;
    if (care.voided || care.payload.lifecycle !== 'completed')
        return 'Eine offene, aufgehobene oder nur geplante Medikationsfassung ist nicht fachlich annehmbar.';
    if ((['administration', 'late_administration', 'prn_administration'].includes(care.kind) && !['administered', 'late'].includes(care.payload.administration.outcome)) || (care.kind === 'non_administration' && !['omitted', 'refused', 'held'].includes(care.payload.administration.outcome)))
        return 'Geplante Gabe oder Auswahl belegt kein prüfbares tatsächliches Medikationsereignis.';
    if (p.action === 'request')
        return p.expectedHeadId !== null || p.expectedRevision !== 0 || p.reviewOriginal !== null || !text(p.reason, 10, 2000) || p.requiredChange !== '' || p.rationale !== '' ? 'Prüfanfrage darf keine Entscheidung vorwegnehmen.' : null;
    const review = p.reviewOriginal;
    if (!review || medicationSafetyReviewOriginalIssue(review, p) || review.medicationRootId !== care.rootId || review.medicationHeadId !== care.headId || review.medicationFingerprint !== care.contentFingerprint || review.medicationKind !== care.kind || review.status !== 'requested' || p.expectedHeadId !== review.headId || p.expectedRevision !== review.revision)
        return 'Aktuelle unveränderte Prüfanfrage und Medikationsfassung stimmen nicht überein.';
    const involved = new Set(care.history.flatMap(item => [item.recordedBy, item.payload.administration.performedBy, item.payload.stock.responsibleBy, item.payload.correction.approvedBy].filter((x): x is string => !!x)));
    if (p.actorId === review.history[0].actorId || involved.has(p.actorId))
        return 'Anfragende, dokumentierende, ausführende, bestandsverantwortliche oder freigebende Personen dürfen dieselbe Fassung nicht selbst entscheiden.';
    if (p.action === 'return')
        return !text(p.reason, 10, 2000) || !text(p.requiredChange, 10, 4000) || p.rationale !== '' ? 'Rückgabe benötigt Grund und konkrete Änderung.' : null;
    return care.payload.sourceReview.decision === 'unresolved' || care.payload.witness.required && care.payload.witness.assertion !== 'independently_authenticated' || p.reason !== '' || p.requiredChange !== '' || !text(p.rationale, 10, 4000) ? 'Annahme benötigt abgeschlossenen Quellenabgleich, erforderliche Zweitsignatur und eigene fachliche Begründung.' : null;
}
export function makeMedicationSafetyReviewPacket(input: Omit<MedicationSafetyReviewPacket, 'schemaVersion'>): MedicationSafetyReviewPacket { const p = clone({ schemaVersion: '1' as const, ...input }); const issue = medicationSafetyReviewPacketIssue(p); if (issue)
    throw Error(issue); return Object.freeze(p); }
