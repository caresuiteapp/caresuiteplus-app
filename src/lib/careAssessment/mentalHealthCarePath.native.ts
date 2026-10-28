// Generated native presentation from src/lib/careAssessment/mentalHealthCarePath.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
export type MentalHealthPathStatus = 'draft' | 'review_requested' | 'returned' | 'released' | 'corrected';
export type MentalHealthSourceRef = Readonly<{
    id: string;
    tenantId: string;
    clientId: string;
    assessmentId: string;
    revision: number;
    recordedAt: string;
    fingerprint: string;
    payload: Record<string, unknown>;
}>;
export type MentalHealthPathSources = Readonly<{
    assessment: readonly MentalHealthSourceRef[];
    topics: readonly MentalHealthSourceRef[];
    risks: readonly MentalHealthSourceRef[];
    measures: readonly MentalHealthSourceRef[];
    evaluations: readonly MentalHealthSourceRef[];
    events: readonly MentalHealthSourceRef[];
    versions: readonly MentalHealthSourceRef[];
    prescriptions: readonly MentalHealthSourceRef[];
    qualifications: readonly MentalHealthSourceRef[];
    approvals: readonly MentalHealthSourceRef[];
    people: readonly MentalHealthSourceRef[];
    paths: readonly MentalHealthSourceRef[];
}>;
export type MentalHealthCareEntry = Readonly<{
    tenantId: string;
    clientId: string;
    assessmentId: string;
    title: string;
    status: MentalHealthPathStatus;
    biography: Readonly<{
        personPerspective: string;
        habits: string;
        interests: string;
        helpfulApproach: string;
        informationSource: string;
        sourceRecordedAt: string | null;
        minimizationNote: string;
    }>;
    orientation: Readonly<{
        observedNeed: string;
        aids: string;
        dailyStructure: string;
        triggers: string;
        agreedIntervention: string;
    }>;
    behaviour: Readonly<{
        observation: string;
        context: string;
        trigger: string;
        response: string;
        course: string;
        observedAt: string | null;
        observedBy: string | null;
    }>;
    crisis: Readonly<{
        signs: string;
        plan: string;
        contacts: string;
        steps: string;
        responsibility: string;
        reviewAt: string | null;
    }>;
    sleep: Readonly<{
        habits: string;
        nightCourse: string;
        disruption: string;
        support: string;
        observedAt: string | null;
    }>;
    participation: Readonly<{
        wish: string;
        contactPerson: string;
        offer: string;
        actualParticipation: string;
        refusal: string;
        observedAt: string | null;
    }>;
    protectedRisk: Readonly<{
        observation: string;
        qualifiedAssessment: string;
        plan: string;
        handover: string;
        assessedBy: string | null;
        assessedAt: string | null;
        needToKnowReason: string;
    }>;
    psychiatricHkp: Readonly<{
        prescriptionId: string | null;
        specialPlan: string;
        qualificationId: string | null;
        course: string;
        approvalId: string | null;
        approvedUntil: string | null;
    }>;
    review: Readonly<{
        requestedBy: string | null;
        requestedAt: string | null;
        releasedBy: string | null;
        releasedAt: string | null;
        returnedBy: string | null;
        returnedAt: string | null;
        returnReason: string;
        correctionTargetId: string | null;
        correctionReason: string;
    }>;
}>;
export type MentalHealthHistoryItem = Readonly<{
    id: string;
    revision: number;
    previousId: string | null;
    recordedAt: string;
    recordedBy: string;
    reason: string;
    status: MentalHealthPathStatus;
    entry: MentalHealthCareEntry;
    fingerprint: string;
}>;
export type MentalHealthCareOriginal = Readonly<{
    id: string;
    tenantId: string;
    clientId: string;
    assessmentId: string;
    rootId: string;
    headId: string;
    revision: number;
    status: MentalHealthPathStatus;
    entry: MentalHealthCareEntry;
    history: readonly MentalHealthHistoryItem[];
}>;
export type MentalHealthCarePacket = Readonly<{
    schemaVersion: '1';
    requestId: string;
    action: 'create' | 'revise';
    tenantId: string;
    clientId: string;
    assessmentId: string;
    actorId: string;
    expectedHeadId: string | null;
    expectedRevision: number;
    entry: MentalHealthCareEntry;
    reason: string;
    original: MentalHealthCareOriginal | null;
    sources: MentalHealthPathSources;
}>;
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const instant = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3,6}Z$/.test(v) && Number.isFinite(Date.parse(v));
const text = (v: unknown, min = 1, max = 4000): v is string => typeof v === 'string' && v.trim().length >= min && v.length <= max;
const sha = (v: unknown) => typeof v === 'string' && /^sha256:[0-9a-f]{64}$/.test(v);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const stable = (v: unknown): string => JSON.stringify(v, (_key, item: unknown) => object(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const freeze = <T>(v: T): T => { if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const child of Object.values(v as Record<string, unknown>))
        freeze(child);
} return v; };
const required = (v: unknown, label: string, min = 3) => text(v, min) ? null : `${label} muss als eigene tatsächliche Angabe dokumentiert sein.`;
const atOrNull = (v: unknown) => v === null || instant(v);
const personOrNull = (v: unknown) => v === null || uuid(v);
const status = new Set<MentalHealthPathStatus>(['draft', 'review_requested', 'returned', 'released', 'corrected']);
const sourceNames = (Object.freeze(['assessment', 'topics', 'risks', 'measures', 'evaluations', 'events', 'versions', 'prescriptions', 'qualifications', 'approvals', 'people', 'paths']) as unknown) as readonly (keyof MentalHealthPathSources)[];
export function blankMentalHealthCareEntry(tenantId: string, clientId: string, assessmentId: string): MentalHealthCareEntry {
    return {
        tenantId, clientId, assessmentId, title: 'Psychosozialer Assessment- und Versorgungsweg', status: 'draft',
        biography: { personPerspective: '', habits: '', interests: '', helpfulApproach: '', informationSource: '', sourceRecordedAt: null, minimizationNote: '' },
        orientation: { observedNeed: '', aids: '', dailyStructure: '', triggers: '', agreedIntervention: '' },
        behaviour: { observation: '', context: '', trigger: '', response: '', course: '', observedAt: null, observedBy: null },
        crisis: { signs: '', plan: '', contacts: '', steps: '', responsibility: '', reviewAt: null }, sleep: { habits: '', nightCourse: '', disruption: '', support: '', observedAt: null },
        participation: { wish: '', contactPerson: '', offer: '', actualParticipation: '', refusal: '', observedAt: null },
        protectedRisk: { observation: '', qualifiedAssessment: '', plan: '', handover: '', assessedBy: null, assessedAt: null, needToKnowReason: '' },
        psychiatricHkp: { prescriptionId: null, specialPlan: '', qualificationId: null, course: '', approvalId: null, approvedUntil: null },
        review: { requestedBy: null, requestedAt: null, releasedBy: null, releasedAt: null, returnedBy: null, returnedAt: null, returnReason: '', correctionTargetId: null, correctionReason: '' },
    };
}
export function mentalHealthPathSourcesIssue(v: unknown): string | null { if (!object(v))
    return 'Der vollständige psychosoziale Quellenbestand fehlt.'; const seen = new Set<string>(); for (const name of sourceNames) {
    const rows = v[name];
    if (!Array.isArray(rows) || rows.length > 5000 || Object.keys(rows).length !== rows.length)
        return `Quellenfamilie ${name} ist unvollständig.`;
    for (const row of rows) {
        if (!object(row) || !uuid(row.id) || !uuid(row.tenantId) || !uuid(row.clientId) || !uuid(row.assessmentId) || !Number.isSafeInteger(row.revision) || Number(row.revision) < 0 || !instant(row.recordedAt) || !sha(row.fingerprint) || !object(row.payload))
            return `Quellenfamilie ${name} enthält kein gültiges natives Original.`;
        if (seen.has(`${name}:${row.id}`))
            return `Quellenfamilie ${name} enthält doppelte Originale.`;
        seen.add(`${name}:${row.id}`);
    }
} return null; }
export function mentalHealthCareEntryIssue(v: unknown): string | null {
    const e = v as MentalHealthCareEntry;
    if (!e || ![e.tenantId, e.clientId, e.assessmentId].every(uuid) || !text(e.title, 3, 300) || !status.has(e.status))
        return 'Psychosozialer Weg ist nicht vollständig an Mandant, Pflegefall, Assessment und Status gebunden.';
    const b = e.biography, o = e.orientation, h = e.behaviour, c = e.crisis, s = e.sleep, p = e.participation, r = e.protectedRisk, k = e.psychiatricHkp, q = e.review;
    let issue = required(b.personPerspective, 'Perspektive der Person') ?? required(b.habits, 'Gewohnheiten') ?? required(b.interests, 'Interessen') ?? required(b.helpfulApproach, 'Hilfreiche Ansprache') ?? required(b.informationSource, 'Informationsquelle') ?? required(b.minimizationNote, 'Datenminimierung', 8);
    if (issue)
        return issue;
    if (!atOrNull(b.sourceRecordedAt))
        return 'Zeitpunkt der biografischen Quelle ist ungültig.';
    issue = required(o.observedNeed, 'Beobachteter Orientierungsbedarf') ?? required(o.aids, 'Orientierungshilfen') ?? required(o.dailyStructure, 'Tagesstruktur') ?? required(o.triggers, 'Belastungsauslöser') ?? required(o.agreedIntervention, 'Vereinbarte Unterstützung');
    if (issue)
        return issue;
    issue = required(h.observation, 'Wertfreie Beobachtung') ?? required(h.context, 'Beobachtungskontext') ?? required(h.trigger, 'Beobachteter Auslöser') ?? required(h.response, 'Tatsächliche Reaktion') ?? required(h.course, 'Tatsächlicher Verlauf');
    if (issue)
        return issue;
    if (!instant(h.observedAt) || !uuid(h.observedBy))
        return 'Verhaltensbeobachtung benötigt tatsächlichen Zeitpunkt und dokumentierende Person.';
    issue = required(c.signs, 'Beobachtete Krisenzeichen') ?? required(c.plan, 'Krisenplan') ?? required(c.contacts, 'Erreichbare Kontakte') ?? required(c.steps, 'Konkrete Krisenschritte') ?? required(c.responsibility, 'Erreichbare Verantwortung');
    if (issue)
        return issue;
    if (!instant(c.reviewAt))
        return 'Krisenplan benötigt einen tatsächlichen Prüftermin.';
    issue = required(s.habits, 'Schlafgewohnheiten') ?? required(s.nightCourse, 'Tatsächlicher Nachtverlauf') ?? required(s.disruption, 'Beobachtete Störung oder Erhebungsgrenze') ?? required(s.support, 'Vereinbarte Unterstützung');
    if (issue)
        return issue;
    if (!instant(s.observedAt))
        return 'Schlaf-/Ruheverlauf benötigt einen tatsächlichen Beobachtungszeitpunkt.';
    issue = required(p.wish, 'Teilhabewunsch') ?? required(p.contactPerson, 'Kontaktperson') ?? required(p.offer, 'Tatsächliches Angebot') ?? required(p.actualParticipation, 'Tatsächliche Teilnahme oder Nichtteilnahme') ?? required(p.refusal, 'Ablehnung oder ausdrückliche Nichtablehnung');
    if (issue)
        return issue;
    if (!instant(p.observedAt))
        return 'Teilhabeverlauf benötigt einen tatsächlichen Zeitpunkt.';
    issue = required(r.observation, 'Schutzrelevante Beobachtung') ?? required(r.qualifiedAssessment, 'Qualifizierte Einschätzung') ?? required(r.plan, 'Schutzplan') ?? required(r.handover, 'Tatsächliche Übergabe') ?? required(r.needToKnowReason, 'Need-to-know-Begründung', 8);
    if (issue)
        return issue;
    if (!uuid(r.assessedBy) || !instant(r.assessedAt))
        return 'Schutzbedarf benötigt qualifizierte Person und tatsächlichen Einschätzungszeitpunkt.';
    if (!uuid(k.prescriptionId) || !uuid(k.qualificationId) || !uuid(k.approvalId) || !instant(k.approvedUntil))
        return 'Psychiatrische HKP benötigt Verordnung, Qualifikationsnachweis, Kostenträgerentscheidung und deren Gültigkeit.';
    issue = required(k.specialPlan, 'Besonderer Behandlungsplan') ?? required(k.course, 'Tatsächlicher Verlauf');
    if (issue)
        return issue;
    if (!personOrNull(q.requestedBy) || !atOrNull(q.requestedAt) || !personOrNull(q.releasedBy) || !atOrNull(q.releasedAt) || !personOrNull(q.returnedBy) || !atOrNull(q.returnedAt) || !personOrNull(q.correctionTargetId))
        return 'Prüf-, Rückgabe-, Freigabe- oder Korrekturidentität ist ungültig.';
    if (e.status === 'review_requested' && (!uuid(q.requestedBy) || !instant(q.requestedAt)))
        return 'Prüfanfrage benötigt eigene Person und tatsächlichen Zeitpunkt.';
    if (e.status === 'returned' && (!uuid(q.returnedBy) || !instant(q.returnedAt) || !text(q.returnReason, 10)))
        return 'Rückgabe benötigt Person, Zeitpunkt und konkreten Grund.';
    if (e.status === 'released' && (!uuid(q.requestedBy) || !instant(q.requestedAt) || !uuid(q.releasedBy) || !instant(q.releasedAt) || q.requestedBy === q.releasedBy))
        return 'Freigabe benötigt vorangehende Prüfanfrage und eine getrennte freigebende Person.';
    if (e.status === 'corrected' && (!uuid(q.correctionTargetId) || !text(q.correctionReason, 10)))
        return 'Append-only-Korrektur benötigt historisches Ziel und konkreten Grund.';
    if (e.status !== 'released' && (q.releasedBy !== null || q.releasedAt !== null))
        return 'Freigabeoriginale dürfen nur im freigegebenen Status gesetzt sein.';
    return null;
}
export function mentalHealthCareOriginalIssue(v: unknown, c: {
    tenantId: string;
    clientId: string;
    assessmentId: string;
}): string | null { const o = v as MentalHealthCareOriginal; if (!o || ![o.id, o.rootId, o.headId].every(uuid) || o.tenantId !== c.tenantId || o.clientId !== c.clientId || o.assessmentId !== c.assessmentId || !Number.isSafeInteger(o.revision) || o.revision < 1 || !status.has(o.status) || !Array.isArray(o.history) || o.history.length !== o.revision || o.history.length > 2000)
    return 'Psychosoziale Historie fehlt, ist abgeschnitten oder fremd.'; for (let n = 0; n < o.history.length; n++) {
    const h = o.history[n], previous = n ? o.history[n - 1].id : null;
    if (!uuid(h.id) || h.revision !== n + 1 || h.previousId !== previous || !instant(h.recordedAt) || !uuid(h.recordedBy) || !text(h.reason, n ? 10 : 0) || !sha(h.fingerprint) || mentalHealthCareEntryIssue(h.entry))
        return 'Psychosoziale Historie besitzt eine Lücke oder ungültige Fassung.';
} const head = o.history.at(-1)!; return o.id !== head.id || o.headId !== head.id || o.status !== head.entry.status || stable(o.entry) !== stable(head.entry) ? 'Psychosozialer Kopf widerspricht seiner vollständigen Historie.' : null; }
export function mentalHealthCarePacketIssue(v: unknown): string | null { const p = v as MentalHealthCarePacket; if (!p || p.schemaVersion !== '1' || !['create', 'revise'].includes(p.action) || ![p.requestId, p.tenantId, p.clientId, p.assessmentId, p.actorId].every(uuid) || p.entry?.tenantId !== p.tenantId || p.entry.clientId !== p.clientId || p.entry.assessmentId !== p.assessmentId)
    return 'Psychosoziale Paketidentität oder Assessmentbindung ist ungültig.'; const issue = mentalHealthPathSourcesIssue(p.sources) ?? mentalHealthCareEntryIssue(p.entry); if (issue)
    return issue; for (const name of sourceNames)
    if (p.sources[name].some(row => row.tenantId !== p.tenantId || row.clientId !== p.clientId || row.assessmentId !== p.assessmentId))
        return `Quellenfamilie ${name} enthält einen fremden Datensatz.`; if (p.sources.assessment.length !== 1 || p.sources.assessment[0].id !== p.assessmentId)
    return 'Genau eine eigene aktuelle Assessmentquelle ist erforderlich.'; const own = (name: keyof MentalHealthPathSources, id: string | null) => id === null ? null : p.sources[name].find(row => row.id === id); if (!own('people', p.entry.behaviour.observedBy) || !own('people', p.entry.protectedRisk.assessedBy))
    return 'Dokumentierende oder einschätzende Person fehlt im vollständigen aktuellen Personenbestand.'; if (!own('prescriptions', p.entry.psychiatricHkp.prescriptionId) || !own('qualifications', p.entry.psychiatricHkp.qualificationId) || !own('approvals', p.entry.psychiatricHkp.approvalId))
    return 'Psychiatrische Verordnung, Qualifikation oder Kostenträgerentscheidung fehlt im aktuellen Originalbestand.'; if (p.entry.status === 'review_requested' && p.entry.review.requestedBy !== p.actorId || p.entry.status === 'released' && p.entry.review.releasedBy !== p.actorId)
    return 'Prüf- oder Freigabeaktion ist nicht an die aktuelle Person gebunden.'; if (p.action === 'create') {
    if (p.original !== null || p.expectedHeadId !== null || p.expectedRevision !== 0 || p.reason)
        return 'Neuanlage darf keinen historischen Kopf vortäuschen.';
}
else {
    const historical = p.original ? mentalHealthCareOriginalIssue(p.original, p) : 'Historisches Original fehlt.';
    if (historical)
        return historical;
    if (p.expectedHeadId !== p.original!.headId || p.expectedRevision !== p.original!.revision || !text(p.reason, 10) || stable(p.entry) === stable(p.original!.entry))
        return 'Fortschreibung benötigt aktuellen CAS-Kopf, konkreten Grund und echte Änderung.';
    if (p.entry.status === 'corrected' && !p.sources.paths.some(row => row.id === p.entry.review.correctionTargetId))
        return 'Korrekturziel fehlt im vollständigen historischen Originalbestand.';
} return null; }
export function makeMentalHealthCarePacket(v: MentalHealthCarePacket): MentalHealthCarePacket { const captured = structuredClone(v), issue = mentalHealthCarePacketIssue(captured); if (issue)
    throw Error(issue); return freeze(captured); }
