// Generated native presentation from src/lib/pflege/treatmentCareReview.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { treatmentCareOriginalIssue, type TreatmentCareKind, type TreatmentCareOriginal } from "./treatmentCarePacket.native.ts";
export type TreatmentCareReviewQualification = Readonly<{
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
    scopeKind: TreatmentCareKind;
    scopeFingerprint: string;
}>;
export type TreatmentCareReviewEvent = Readonly<{
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
    treatmentHeadId: string;
    treatmentFingerprint: string;
    qualification: TreatmentCareReviewQualification | null;
    fingerprint: string;
}>;
export type TreatmentCareReviewOriginal = Readonly<{
    id: string;
    tenantId: string;
    clientId: string;
    orderId: string;
    rootId: string;
    headId: string;
    revision: number;
    treatmentRootId: string;
    treatmentHeadId: string;
    treatmentFingerprint: string;
    treatmentKind: TreatmentCareKind;
    status: 'requested' | 'returned' | 'accepted';
    history: readonly TreatmentCareReviewEvent[];
}>;
export type TreatmentCareReviewPacket = Readonly<{
    schemaVersion: '1';
    action: 'request' | 'return' | 'accept';
    requestId: string;
    tenantId: string;
    clientId: string;
    orderId: string;
    actorId: string;
    expectedHeadId: string | null;
    expectedRevision: number;
    treatmentOriginal: TreatmentCareOriginal;
    reviewOriginal: TreatmentCareReviewOriginal | null;
    reason: string;
    requiredChange: string;
    rationale: string;
}>;
const kinds = new Set<TreatmentCareKind>(['order_review', 'payer_review', 'injection', 'insulin', 'infusion', 'pump', 'inhalation', 'instillation', 'compression', 'access_drain', 'other_hkp', 'order_revision', 'measurement_link', 'completion_review', 'correction']);
const actualKinds = new Set<TreatmentCareKind>(['injection', 'insulin', 'infusion', 'pump', 'inhalation', 'instillation', 'compression', 'access_drain', 'other_hkp']);
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const sha = (v: unknown): v is string => typeof v === 'string' && /^sha256:[0-9a-f]{64}$/.test(v);
const text = (v: unknown, min = 0, max = 8000): v is string => typeof v === 'string' && v.trim().length >= min && v.length <= max;
const clone = <T>(v: T): T => structuredClone(v);
export const treatmentReviewStable = (v: unknown): string => JSON.stringify(v, (_key, item: unknown) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, (item as Record<string, unknown>)[key]])) : item);
export function treatmentReviewInstantMicros(v: unknown): bigint | null {
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
const calendarDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && treatmentReviewInstantMicros(`${v}T00:00:00Z`) !== null;
const berlinDay = (at: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at));
function qualificationIssue(q: TreatmentCareReviewQualification | null, actor: string, kind: TreatmentCareKind, at: string): string | null {
    if (!q || ![q.id, q.employeeId, q.profileId, q.documentId, q.scopeId].every(uuid) || q.profileId !== actor || q.scopeKind !== kind || !text(q.qualificationType, 1, 200) || !text(q.title, 1, 500) || !['valid', 'expires_soon'].includes(q.status) || ![q.documentFingerprint, q.sourceFingerprint, q.employeeFingerprint, q.scopeFingerprint].every(sha) || !calendarDate(q.employmentStart) || q.employmentEnd !== null && !calendarDate(q.employmentEnd) || q.issuedAt !== null && !calendarDate(q.issuedAt) || q.validUntil !== null && !calendarDate(q.validUntil))
        return 'Vollständige Beschäftigungs-, Qualifikations-, Dokument- und Prüfbereichsoriginale fehlen.';
    const verified = treatmentReviewInstantMicros(q.verifiedAt), updated = treatmentReviewInstantMicros(q.updatedAt), recorded = treatmentReviewInstantMicros(at);
    if (verified === null || updated === null || recorded === null || verified > recorded || updated > recorded)
        return 'Qualifikation war zum Prüfzeitpunkt nicht verifiziert.';
    const day = berlinDay(at);
    return q.employmentStart > day || q.employmentEnd !== null && q.employmentEnd < day || q.issuedAt !== null && q.issuedAt > day || q.validUntil !== null && q.validUntil < day ? 'Beschäftigung oder Qualifikation gilt am Prüftag nicht.' : null;
}
export function treatmentCareReviewOriginalIssue(v: unknown, c: {
    tenantId: string;
    clientId: string;
    orderId: string;
}): string | null {
    const o = v as TreatmentCareReviewOriginal;
    if (!o || ![o.id, o.rootId, o.headId, o.treatmentRootId, o.treatmentHeadId].every(uuid) || o.tenantId !== c.tenantId || o.clientId !== c.clientId || o.orderId !== c.orderId || !kinds.has(o.treatmentKind) || !sha(o.treatmentFingerprint) || ![1, 2].includes(o.revision) || !Array.isArray(o.history) || o.history.length !== o.revision)
        return 'Vollständiges Behandlungspflegeprüforiginal fehlt.';
    const ids = new Set<string>(), requests = new Set<string>();
    for (let i = 0; i < o.history.length; i++) {
        const e = o.history[i], prior = i ? o.history[i - 1] : null;
        if (!e || ![e.id, e.requestId, e.actorId, e.treatmentHeadId].every(uuid) || ids.has(e.id) || requests.has(e.requestId) || e.revision !== i + 1 || e.previousId !== (prior?.id ?? null) || e.treatmentHeadId !== o.treatmentHeadId || e.treatmentFingerprint !== o.treatmentFingerprint || treatmentReviewInstantMicros(e.recordedAt) === null || !text(e.actorName, 1, 500) || !sha(e.fingerprint))
            return 'Behandlungspflegeprüfhistorie ist abgeschnitten, doppelt oder an eine andere Fassung gebunden.';
        if (!i) {
            if (e.action !== 'request' || !text(e.reason, 10, 2000) || e.requiredChange !== '' || e.rationale !== '' || e.qualification !== null)
                return 'Behandlungspflegeprüfanfrage enthält eine unzulässige Entscheidung.';
        }
        else {
            if (prior!.action !== 'request' || e.actorId === prior!.actorId || treatmentReviewInstantMicros(e.recordedAt)! < treatmentReviewInstantMicros(prior!.recordedAt)!)
                return 'Prüfentscheidung benötigt eine zeitlich nachfolgende getrennte Person.';
            const issue = qualificationIssue(e.qualification, e.actorId, o.treatmentKind, e.recordedAt);
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
    return first.id !== o.rootId || o.id !== o.headId || last.id !== o.headId || o.status !== (last.action === 'request' ? 'requested' : last.action === 'return' ? 'returned' : last.action === 'accept' ? 'accepted' : null) ? 'Prüfkopf stimmt nicht mit der vollständigen Behandlungspflegeprüfhistorie überein.' : null;
}
export function treatmentCareReviewPacketIssue(v: unknown): string | null {
    const p = v as TreatmentCareReviewPacket;
    if (!p || p.schemaVersion !== '1' || !['request', 'return', 'accept'].includes(p.action) || ![p.requestId, p.tenantId, p.clientId, p.orderId, p.actorId].every(uuid) || !Number.isSafeInteger(p.expectedRevision) || p.expectedRevision < 0)
        return 'Behandlungspflegeprüfanfrage ist nicht vollständig gebunden.';
    const issue = treatmentCareOriginalIssue(p.treatmentOriginal, { tenantId: p.tenantId, clientId: p.clientId, orderId: p.orderId });
    if (issue)
        return issue;
    const care = p.treatmentOriginal;
    if (!care.payload.material)
        return 'Ältere Behandlungspflegefassung bleibt exakt lesbar, benötigt vor einer Fachprüfung aber eine append-only Fortschreibung mit ausdrücklicher Materialentscheidung.';
    if (care.voided || care.payload.lifecycle !== 'completed')
        return 'Eine offene, aufgehobene oder nur geplante Behandlungspflegefassung ist nicht fachlich annehmbar.';
    if (actualKinds.has(care.kind) && !['performed', 'partial', 'omitted', 'refused', 'failed'].includes(care.payload.execution.outcome))
        return 'Planung oder Auswahl belegt kein prüfbares tatsächliches Behandlungspflegeereignis.';
    if (p.action === 'request')
        return p.expectedHeadId !== null || p.expectedRevision !== 0 || p.reviewOriginal !== null || !text(p.reason, 10, 2000) || p.requiredChange !== '' || p.rationale !== '' ? 'Prüfanfrage darf keine Entscheidung vorwegnehmen.' : null;
    const review = p.reviewOriginal;
    if (!review || treatmentCareReviewOriginalIssue(review, p) || review.treatmentRootId !== care.rootId || review.treatmentHeadId !== care.headId || review.treatmentFingerprint !== care.contentFingerprint || review.treatmentKind !== care.kind || review.status !== 'requested' || p.expectedHeadId !== review.headId || p.expectedRevision !== review.revision)
        return 'Aktuelle unveränderte Prüfanfrage und Behandlungspflegefassung stimmen nicht überein.';
    const involved = new Set(care.history.flatMap(item => [item.recordedBy, item.payload.qualification.performedBy, item.payload.qualification.reviewedBy, item.payload.followUp.responsibleBy, item.payload.correction.approvedBy].filter((x): x is string => !!x)));
    if (p.actorId === review.history[0].actorId || involved.has(p.actorId))
        return 'Anfragende, dokumentierende, ausführende, kontrollierende oder bereits freigebende Personen dürfen dieselbe Fassung nicht selbst entscheiden.';
    if (p.action === 'return')
        return !text(p.reason, 10, 2000) || !text(p.requiredChange, 10, 4000) || p.rationale !== '' ? 'Rückgabe benötigt Grund und konkrete Änderung.' : null;
    return care.payload.order.status !== 'active' || care.payload.payer.state === 'unknown' || care.payload.qualification.state === 'unconfirmed' || ['pending', 'scheduled'].includes(care.payload.followUp.state) || actualKinds.has(care.kind) && care.payload.material.state === 'selected' || p.reason !== '' || p.requiredChange !== '' || !text(p.rationale, 10, 4000) ? 'Annahme benötigt aktive Verordnung, geklärte Finanzierung, Qualifikation, Materialentscheidung, Folgeabschluss und eigene fachliche Begründung.' : null;
}
export function makeTreatmentCareReviewPacket(input: Omit<TreatmentCareReviewPacket, 'schemaVersion'>): TreatmentCareReviewPacket { const p = clone({ schemaVersion: '1' as const, ...input }); const issue = treatmentCareReviewPacketIssue(p); if (issue)
    throw Error(issue); return Object.freeze(p); }
