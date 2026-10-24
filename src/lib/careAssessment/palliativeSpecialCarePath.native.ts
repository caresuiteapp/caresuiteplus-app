// Generated native presentation from src/lib/careAssessment/palliativeSpecialCarePath.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
export type PalliativeSpecialPathStatus = 'draft' | 'review_requested' | 'returned' | 'released' | 'corrected';
export type PalliativeSpecialSourceRef = Readonly<{
    id: string;
    tenantId: string;
    clientId: string;
    assessmentId: string;
    revision: number;
    recordedAt: string;
    fingerprint: string;
    payload: Record<string, unknown>;
}>;
export type PalliativeSpecialPathSources = Readonly<{
    assessment: readonly PalliativeSpecialSourceRef[];
    plans: readonly PalliativeSpecialSourceRef[];
    documents: readonly PalliativeSpecialSourceRef[];
    orders: readonly PalliativeSpecialSourceRef[];
    observations: readonly PalliativeSpecialSourceRef[];
    interventions: readonly PalliativeSpecialSourceRef[];
    contacts: readonly PalliativeSpecialSourceRef[];
    confirmations: readonly PalliativeSpecialSourceRef[];
    guardianships: readonly PalliativeSpecialSourceRef[];
    qualifications: readonly PalliativeSpecialSourceRef[];
    approvals: readonly PalliativeSpecialSourceRef[];
    people: readonly PalliativeSpecialSourceRef[];
    paths: readonly PalliativeSpecialSourceRef[];
}>;
export type PalliativeSpecialCareEntry = Readonly<{
    tenantId: string;
    clientId: string;
    assessmentId: string;
    title: string;
    status: PalliativeSpecialPathStatus;
    goals: Readonly<{
        personWishes: string;
        careGoal: string;
        involvedPeople: string;
        informationSource: string;
        reviewedAt: string | null;
        medicalOrderId: string | null;
        orderBoundary: string;
    }>;
    advanceDirective: Readonly<{
        documentId: string | null;
        documentVersion: string;
        documentRecordedAt: string | null;
        reviewStatus: string;
        reviewedBy: string | null;
        reviewedAt: string | null;
        contactPerson: string;
        accessInstructions: string;
        outdatedVersionNote: string;
    }>;
    symptoms: Readonly<{
        pain: string;
        dyspnea: string;
        nausea: string;
        burden: string;
        observedAt: string | null;
        intervention: string;
        interventionAt: string | null;
        effectControl: string;
        controlledAt: string | null;
        documentedBy: string | null;
    }>;
    dyingPhase: Readonly<{
        observation: string;
        support: string;
        contactPerson: string;
        contactAgreement: string;
        contactAttempt: string;
        reachedAt: string | null;
        handover: string;
    }>;
    deathClosure: Readonly<{
        observedAt: string | null;
        observedBy: string | null;
        medicalConfirmationId: string | null;
        confirmedAt: string | null;
        confirmedBy: string | null;
        notifiedContacts: string;
        materialReturn: string;
        contractClosure: string;
        closedAt: string | null;
    }>;
    pediatric: Readonly<{
        subjectGroup: 'minor' | 'adult';
        guardianId: string | null;
        guardianBasis: string;
        developmentContext: string;
        weightKg: number | null;
        weightMeasuredAt: string | null;
        specificPlan: string;
        adultSchemaBoundary: string;
    }>;
    complexParticipation: Readonly<{
        communicationAids: string;
        assistant: string;
        resources: string;
        coordination: string;
        immediateHandover: string;
    }>;
    specializedCare: Readonly<{
        profile: string;
        contractId: string | null;
        qualificationId: string | null;
        evidence: string;
        verificationState: 'unverified';
        verificationNote: string;
    }>;
    specialService: Readonly<{
        serviceOrder: string;
        responsibility: string;
        qualificationId: string | null;
        approvalId: string | null;
        contactPoint: string;
        specificReleaseBoundary: string;
    }>;
    culturalCare: Readonly<{
        wishes: string;
        language: string;
        interpreter: string;
        religiousNeeds: string;
        agreedHelp: string;
        individualBasis: string;
        stereotypeGuard: string;
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
export type PalliativeSpecialHistoryItem = Readonly<{
    id: string;
    revision: number;
    previousId: string | null;
    recordedAt: string;
    recordedBy: string;
    reason: string;
    status: PalliativeSpecialPathStatus;
    entry: PalliativeSpecialCareEntry;
    fingerprint: string;
}>;
export type PalliativeSpecialCareOriginal = Readonly<{
    id: string;
    tenantId: string;
    clientId: string;
    assessmentId: string;
    rootId: string;
    headId: string;
    revision: number;
    status: PalliativeSpecialPathStatus;
    entry: PalliativeSpecialCareEntry;
    history: readonly PalliativeSpecialHistoryItem[];
}>;
export type PalliativeSpecialCarePacket = Readonly<{
    schemaVersion: '1';
    requestId: string;
    action: 'create' | 'revise';
    tenantId: string;
    clientId: string;
    assessmentId: string;
    actorId: string;
    expectedHeadId: string | null;
    expectedRevision: number;
    entry: PalliativeSpecialCareEntry;
    reason: string;
    original: PalliativeSpecialCareOriginal | null;
    sources: PalliativeSpecialPathSources;
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
const status = new Set<PalliativeSpecialPathStatus>(['draft', 'review_requested', 'returned', 'released', 'corrected']);
const sourceNames = (Object.freeze(['assessment', 'plans', 'documents', 'orders', 'observations', 'interventions', 'contacts', 'confirmations', 'guardianships', 'qualifications', 'approvals', 'people', 'paths']) as unknown) as readonly (keyof PalliativeSpecialPathSources)[];
export function blankPalliativeSpecialCareEntry(tenantId: string, clientId: string, assessmentId: string): PalliativeSpecialCareEntry {
    return { tenantId, clientId, assessmentId, title: 'Palliativversorgung und besondere Lebenslagen', status: 'draft',
        goals: { personWishes: '', careGoal: '', involvedPeople: '', informationSource: '', reviewedAt: null, medicalOrderId: null, orderBoundary: '' }, advanceDirective: { documentId: null, documentVersion: '', documentRecordedAt: null, reviewStatus: '', reviewedBy: null, reviewedAt: null, contactPerson: '', accessInstructions: '', outdatedVersionNote: '' },
        symptoms: { pain: '', dyspnea: '', nausea: '', burden: '', observedAt: null, intervention: '', interventionAt: null, effectControl: '', controlledAt: null, documentedBy: null }, dyingPhase: { observation: '', support: '', contactPerson: '', contactAgreement: '', contactAttempt: '', reachedAt: null, handover: '' },
        deathClosure: { observedAt: null, observedBy: null, medicalConfirmationId: null, confirmedAt: null, confirmedBy: null, notifiedContacts: '', materialReturn: '', contractClosure: '', closedAt: null }, pediatric: { subjectGroup: 'adult', guardianId: null, guardianBasis: '', developmentContext: '', weightKg: null, weightMeasuredAt: null, specificPlan: '', adultSchemaBoundary: '' },
        complexParticipation: { communicationAids: '', assistant: '', resources: '', coordination: '', immediateHandover: '' }, specializedCare: { profile: '', contractId: null, qualificationId: null, evidence: '', verificationState: 'unverified', verificationNote: '' }, specialService: { serviceOrder: '', responsibility: '', qualificationId: null, approvalId: null, contactPoint: '', specificReleaseBoundary: '' },
        culturalCare: { wishes: '', language: '', interpreter: '', religiousNeeds: '', agreedHelp: '', individualBasis: '', stereotypeGuard: '' }, review: { requestedBy: null, requestedAt: null, releasedBy: null, releasedAt: null, returnedBy: null, returnedAt: null, returnReason: '', correctionTargetId: null, correctionReason: '' } };
}
export function palliativeSpecialPathSourcesIssue(v: unknown): string | null { if (!object(v))
    return 'Der vollständige Palliativ- und Spezialversorgungsquellenbestand fehlt.'; const seen = new Set<string>(); for (const name of sourceNames) {
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
export function palliativeSpecialCareEntryIssue(v: unknown): string | null {
    const e = v as PalliativeSpecialCareEntry;
    if (!e || ![e.tenantId, e.clientId, e.assessmentId].every(uuid) || !text(e.title, 3, 300) || !status.has(e.status))
        return 'Palliativ- und Spezialversorgungsweg ist nicht vollständig an Mandant, Pflegefall, Assessment und Status gebunden.';
    const g = e.goals, d = e.advanceDirective, s = e.symptoms, y = e.dyingPhase, c = e.deathClosure, p = e.pediatric, x = e.complexParticipation, z = e.specializedCare, l = e.specialService, k = e.culturalCare, r = e.review;
    let issue = required(g.personWishes, 'Wünsche der Person') ?? required(g.careGoal, 'Palliatives Versorgungsziel') ?? required(g.involvedPeople, 'Beteiligte') ?? required(g.informationSource, 'Informationsquelle') ?? required(g.orderBoundary, 'Abgrenzung zur ärztlichen Anordnung', 8);
    if (issue)
        return issue;
    if (!instant(g.reviewedAt) || !uuid(g.medicalOrderId))
        return 'Zielvereinbarung benötigt aktuellen Prüfzeitpunkt und eine getrennte ärztliche Anordnungsquelle.';
    issue = required(d.documentVersion, 'Dokumentfassung') ?? required(d.reviewStatus, 'Gültigkeitsprüfung') ?? required(d.contactPerson, 'Vorsorgekontakt') ?? required(d.accessInstructions, 'Zugriffsweg') ?? required(d.outdatedVersionNote, 'Kennzeichnung veralteter Fassungen');
    if (issue)
        return issue;
    if (!uuid(d.documentId) || !instant(d.documentRecordedAt) || !uuid(d.reviewedBy) || !instant(d.reviewedAt))
        return 'Patientenverfügung benötigt Dokument, Fassung, Prüfungsperson und tatsächliche Zeitpunkte.';
    for (const [value, label] of [[s.pain, 'Schmerzbeobachtung'], [s.dyspnea, 'Atemnotbeobachtung'], [s.nausea, 'Übelkeitsbeobachtung'], [s.burden, 'Belastungsbeobachtung'], [s.intervention, 'Tatsächliche Maßnahme'], [s.effectControl, 'Wirkungskontrolle']] as const) {
        issue = required(value, label);
        if (issue)
            return issue;
    }
    if (!instant(s.observedAt) || !instant(s.interventionAt) || !instant(s.controlledAt) || !uuid(s.documentedBy))
        return 'Symptomverlauf benötigt getrennte Beobachtungs-, Maßnahmen- und Kontrollzeitpunkte sowie dokumentierende Person.';
    issue = required(y.observation, 'Beobachtung der Sterbephase') ?? required(y.support, 'Tatsächliche Unterstützung') ?? required(y.contactPerson, 'Ansprechperson') ?? required(y.contactAgreement, 'Kontaktvereinbarung') ?? required(y.contactAttempt, 'Tatsächlicher Kontaktversuch') ?? required(y.handover, 'Übergabe');
    if (issue)
        return issue;
    if (!instant(y.reachedAt))
        return 'Sterbephase benötigt einen tatsächlichen Kontakt- oder Erreichbarkeitszeitpunkt.';
    issue = required(c.notifiedContacts, 'Benachrichtigte Kontakte') ?? required(c.materialReturn, 'Materialabschluss') ?? required(c.contractClosure, 'Vertragsabschluss');
    if (issue)
        return issue;
    if (!instant(c.observedAt) || !uuid(c.observedBy) || !uuid(c.medicalConfirmationId) || !instant(c.confirmedAt) || !uuid(c.confirmedBy) || !instant(c.closedAt))
        return 'Tod und Abschluss benötigen getrennte Beobachtung, medizinische Feststellungsquelle, Personen und Zeitpunkte.';
    if (!['minor', 'adult'].includes(p.subjectGroup))
        return 'Alters-/Sorgekontext ist ungültig.';
    if (!text(p.adultSchemaBoundary, 8))
        return 'Die Grenze gegen eine unbemerkte Übertragung von Erwachsenen- und Kinderschemata muss ausdrücklich dokumentiert sein.';
    if (p.subjectGroup === 'minor' && (!uuid(p.guardianId) || !text(p.guardianBasis, 3) || !text(p.developmentContext, 3) || typeof p.weightKg !== 'number' || !Number.isFinite(p.weightKg) || p.weightKg <= 0 || !instant(p.weightMeasuredAt) || !text(p.specificPlan, 3)))
        return 'Versorgung Minderjähriger benötigt Sorgeberechtigung, Entwicklungsbezug, aktuelles Gewicht und spezifischen Plan.';
    issue = required(x.communicationAids, 'Kommunikationshilfen') ?? required(x.assistant, 'Assistenz') ?? required(x.resources, 'Ressourcen') ?? required(x.coordination, 'Koordination') ?? required(x.immediateHandover, 'Unmittelbar auffindbare Einsatzübergabe');
    if (issue)
        return issue;
    issue = required(z.profile, 'Spezialprofil') ?? required(z.evidence, 'Spezialnachweise') ?? required(z.verificationNote, 'Offene eigene Abnahme', 8);
    if (issue)
        return issue;
    if (z.verificationState !== 'unverified' || !uuid(z.contractId) || !uuid(z.qualificationId))
        return 'Spezialprofil muss bis zu eigener Abnahme ungeprüft bleiben und Vertrag sowie Fachnachweis getrennt binden.';
    issue = required(l.serviceOrder, 'Gesonderter Leistungsauftrag') ?? required(l.responsibility, 'Zuständigkeit') ?? required(l.contactPoint, 'Ansprechstelle') ?? required(l.specificReleaseBoundary, 'Spezifische Freigabegrenze', 8);
    if (issue)
        return issue;
    if (!uuid(l.qualificationId) || !uuid(l.approvalId))
        return 'Gesonderte Spezialleistung benötigt eigenen Fachnachweis und eigene Freigabequelle.';
    issue = required(k.wishes, 'Individuelle Wünsche') ?? required(k.language, 'Sprache') ?? required(k.interpreter, 'Sprachunterstützung') ?? required(k.religiousNeeds, 'Individuelle religiöse Bedürfnisse oder ausdrückliche Nichtangabe') ?? required(k.agreedHelp, 'Vereinbarte Hilfe') ?? required(k.individualBasis, 'Individuelle Quelle') ?? required(k.stereotypeGuard, 'Abgrenzung von Stereotypen', 8);
    if (issue)
        return issue;
    if (!personOrNull(r.requestedBy) || !atOrNull(r.requestedAt) || !personOrNull(r.releasedBy) || !atOrNull(r.releasedAt) || !personOrNull(r.returnedBy) || !atOrNull(r.returnedAt) || !personOrNull(r.correctionTargetId))
        return 'Prüf-, Rückgabe-, Freigabe- oder Korrekturidentität ist ungültig.';
    if (e.status === 'review_requested' && (!uuid(r.requestedBy) || !instant(r.requestedAt)))
        return 'Prüfanfrage benötigt eigene Person und tatsächlichen Zeitpunkt.';
    if (e.status === 'returned' && (!uuid(r.returnedBy) || !instant(r.returnedAt) || !text(r.returnReason, 10)))
        return 'Rückgabe benötigt Person, Zeitpunkt und konkreten Grund.';
    if (e.status === 'released' && (!uuid(r.requestedBy) || !instant(r.requestedAt) || !uuid(r.releasedBy) || !instant(r.releasedAt) || r.requestedBy === r.releasedBy))
        return 'Freigabe benötigt vorangehende Prüfanfrage und eine getrennte freigebende Person.';
    if (e.status === 'corrected' && (!uuid(r.correctionTargetId) || !text(r.correctionReason, 10)))
        return 'Append-only-Korrektur benötigt historisches Ziel und konkreten Grund.';
    if (e.status !== 'released' && (r.releasedBy !== null || r.releasedAt !== null))
        return 'Freigabeoriginale dürfen nur im freigegebenen Status gesetzt sein.';
    return null;
}
export function palliativeSpecialCareOriginalIssue(v: unknown, c: {
    tenantId: string;
    clientId: string;
    assessmentId: string;
}): string | null { const o = v as PalliativeSpecialCareOriginal; if (!o || ![o.id, o.rootId, o.headId].every(uuid) || o.tenantId !== c.tenantId || o.clientId !== c.clientId || o.assessmentId !== c.assessmentId || !Number.isSafeInteger(o.revision) || o.revision < 1 || !status.has(o.status) || !Array.isArray(o.history) || o.history.length !== o.revision || o.history.length > 2000)
    return 'Palliativ- und Spezialversorgungshistorie fehlt, ist abgeschnitten oder fremd.'; for (let n = 0; n < o.history.length; n++) {
    const h = o.history[n], previous = n ? o.history[n - 1].id : null;
    if (!uuid(h.id) || h.revision !== n + 1 || h.previousId !== previous || !instant(h.recordedAt) || !uuid(h.recordedBy) || !text(h.reason, n ? 10 : 0) || !sha(h.fingerprint) || palliativeSpecialCareEntryIssue(h.entry))
        return 'Palliativ- und Spezialversorgungshistorie besitzt eine Lücke oder ungültige Fassung.';
} const head = o.history.at(-1)!; return o.id !== head.id || o.headId !== head.id || o.status !== head.entry.status || stable(o.entry) !== stable(head.entry) ? 'Palliativ- und Spezialversorgungskopf widerspricht seiner vollständigen Historie.' : null; }
export function palliativeSpecialCarePacketIssue(v: unknown): string | null { const p = v as PalliativeSpecialCarePacket; if (!p || p.schemaVersion !== '1' || !['create', 'revise'].includes(p.action) || ![p.requestId, p.tenantId, p.clientId, p.assessmentId, p.actorId].every(uuid) || p.entry?.tenantId !== p.tenantId || p.entry.clientId !== p.clientId || p.entry.assessmentId !== p.assessmentId)
    return 'Palliativ- und Spezialversorgungspaket besitzt eine ungültige Aktenbindung.'; const issue = palliativeSpecialPathSourcesIssue(p.sources) ?? palliativeSpecialCareEntryIssue(p.entry); if (issue)
    return issue; for (const name of sourceNames)
    if (p.sources[name].some(row => row.tenantId !== p.tenantId || row.clientId !== p.clientId || row.assessmentId !== p.assessmentId))
        return `Quellenfamilie ${name} enthält einen fremden Datensatz.`; if (p.sources.assessment.length !== 1 || p.sources.assessment[0].id !== p.assessmentId)
    return 'Genau eine eigene aktuelle Assessmentquelle ist erforderlich.'; const own = (name: keyof PalliativeSpecialPathSources, id: string | null) => id === null ? null : p.sources[name].find(row => row.id === id); const e = p.entry; if (!own('orders', e.goals.medicalOrderId) || !own('documents', e.advanceDirective.documentId) || !own('people', e.advanceDirective.reviewedBy) || !own('people', e.symptoms.documentedBy) || !own('people', e.deathClosure.observedBy) || !own('people', e.deathClosure.confirmedBy) || !own('confirmations', e.deathClosure.medicalConfirmationId))
    return 'Anordnung, Verfügung, medizinische Feststellung oder beteiligte Person fehlt im vollständigen aktuellen Originalbestand.'; if (e.pediatric.subjectGroup === 'minor' && !own('guardianships', e.pediatric.guardianId))
    return 'Sorgeberechtigung fehlt im vollständigen aktuellen Originalbestand.'; if (!own('documents', e.specializedCare.contractId) || !own('qualifications', e.specializedCare.qualificationId) || !own('qualifications', e.specialService.qualificationId) || !own('approvals', e.specialService.approvalId))
    return 'Spezialvertrag, Fachnachweis oder spezifische Freigabequelle fehlt im aktuellen Originalbestand.'; if (e.status === 'review_requested' && e.review.requestedBy !== p.actorId || e.status === 'released' && e.review.releasedBy !== p.actorId)
    return 'Prüf- oder Freigabeaktion ist nicht an die aktuelle Person gebunden.'; if (p.action === 'create') {
    if (p.original !== null || p.expectedHeadId !== null || p.expectedRevision !== 0 || p.reason)
        return 'Neuanlage darf keinen historischen Kopf vortäuschen.';
}
else {
    const historical = p.original ? palliativeSpecialCareOriginalIssue(p.original, p) : 'Historisches Original fehlt.';
    if (historical)
        return historical;
    if (p.expectedHeadId !== p.original!.headId || p.expectedRevision !== p.original!.revision || !text(p.reason, 10) || stable(p.entry) === stable(p.original!.entry))
        return 'Fortschreibung benötigt aktuellen CAS-Kopf, konkreten Grund und echte Änderung.';
    if (e.status === 'corrected' && !p.sources.paths.some(row => row.id === e.review.correctionTargetId))
        return 'Korrekturziel fehlt im vollständigen historischen Originalbestand.';
} return null; }
export function makePalliativeSpecialCarePacket(v: PalliativeSpecialCarePacket): PalliativeSpecialCarePacket { const captured = structuredClone(v), issue = palliativeSpecialCarePacketIssue(captured); if (issue)
    throw Error(issue); return freeze(captured); }
