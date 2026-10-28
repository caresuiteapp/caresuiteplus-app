// Generated native presentation from src/lib/pflege/respiratoryIntensiveCarePath.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
export type RespiratoryCareKind = 'oxygen_support' | 'tracheostomy_care' | 'suction' | 'ventilation_review' | 'alarm_response' | 'emergency_equipment' | 'qualification_review' | 'intensive_handover' | 'correction';
export type RespiratoryCareRef = Readonly<{
    id: string;
    revision: number;
    recordedAt: string;
    fingerprint: string;
    tenantId: string;
    clientId: string;
    measurementId: string;
    payload: Record<string, unknown>;
}>;
export type RespiratoryCareSources = Readonly<{
    measurements: readonly RespiratoryCareRef[];
    medicalOrders: readonly RespiratoryCareRef[];
    devices: readonly RespiratoryCareRef[];
    calibrations: readonly RespiratoryCareRef[];
    treatmentExecutions: readonly RespiratoryCareRef[];
    qualifications: readonly RespiratoryCareRef[];
    handovers: readonly RespiratoryCareRef[];
    people: readonly RespiratoryCareRef[];
    paths: readonly RespiratoryCareRef[];
}>;
export type RespiratoryCareEntry = Readonly<{
    kind: RespiratoryCareKind;
    title: string;
    tenantId: string;
    clientId: string;
    measurementId: string;
    observedAt: string;
    source: Readonly<{
        measurementType: string;
        values: Record<string, number>;
        unit: string;
        context: Record<string, string>;
        medicalOrderId: string | null;
        deviceId: string | null;
        calibrationId: string | null;
    }>;
    oxygen: Readonly<{
        prescribedFlow: string;
        actualFlow: string;
        application: string;
        device: string;
        occurredAt: string | null;
        performedBy: string | null;
    }>;
    tracheostomy: Readonly<{
        cannulaType: string;
        care: string;
        changeBasis: string;
        skin: string;
        secretion: string;
        occurredAt: string | null;
        performedBy: string | null;
    }>;
    suction: Readonly<{
        reason: string;
        route: string;
        secretion: string;
        execution: string;
        tolerance: string;
        occurredAt: string | null;
        performedBy: string | null;
        followUp: string;
    }>;
    ventilation: Readonly<{
        mode: string;
        prescribedSettings: Record<string, string>;
        actualSettings: Record<string, string>;
        occurredAt: string | null;
        reviewedBy: string | null;
        deviation: string;
    }>;
    alarm: Readonly<{
        label: string;
        beganAt: string | null;
        acknowledgedAt: string | null;
        reaction: string;
        cause: string;
        resolvedAt: string | null;
        control: string;
        responsibleBy: string | null;
    }>;
    equipment: Readonly<{
        required: string;
        present: string;
        missing: string;
        functionCheckAt: string | null;
        functionResult: string;
        responsibleBy: string | null;
        resolvedAt: string | null;
    }>;
    qualification: Readonly<{
        requirement: string;
        qualificationId: string | null;
        evidence: string;
        validUntil: string | null;
        instruction: string;
        reviewedBy: string | null;
        eligible: 'unknown' | 'eligible' | 'not_eligible';
    }>;
    handover: Readonly<{
        careProfile: string;
        monitoring: string;
        pending: string;
        recipient: string;
        handedOverAt: string | null;
        handedOverBy: string | null;
        specialistApproval: 'not_requested' | 'pending' | 'approved' | 'rejected';
        approvedBy: string | null;
        approvedAt: string | null;
    }>;
    correction: Readonly<{
        targetId: string | null;
        reason: string;
        replacementId: string | null;
        approvedBy: string | null;
        approvedAt: string | null;
    }>;
}>;
export type RespiratoryCareHistoryItem = Readonly<{
    id: string;
    revision: number;
    previousId: string | null;
    recordedAt: string;
    recordedBy: string;
    recordedByName: string;
    reason: string;
    payload: RespiratoryCareEntry;
    contentFingerprint: string;
}>;
export type RespiratoryCareOriginal = Readonly<{
    id: string;
    tenantId: string;
    clientId: string;
    measurementId: string;
    rootId: string;
    headId: string;
    revision: number;
    kind: RespiratoryCareKind;
    recordedAt: string;
    recordedBy: string;
    recordedByName: string;
    payload: RespiratoryCareEntry;
    contentFingerprint: string;
    history: readonly RespiratoryCareHistoryItem[];
}>;
export type RespiratoryCarePacket = Readonly<{
    schemaVersion: '1';
    action: 'create' | 'revise';
    requestId: string;
    tenantId: string;
    clientId: string;
    measurementId: string;
    actorId: string;
    expectedHeadId: string | null;
    expectedRevision: number;
    entry: RespiratoryCareEntry;
    reason: string;
    original: RespiratoryCareOriginal | null;
    sources: RespiratoryCareSources;
}>;
export const respiratoryKinds = new Set<RespiratoryCareKind>(['oxygen_support', 'tracheostomy_care', 'suction', 'ventilation_review', 'alarm_response', 'emergency_equipment', 'qualification_review', 'intensive_handover', 'correction']);
const respiratoryMeasurementTypes = new Set(['respiratory_rate', 'oxygen', 'oxygen_saturation', 'oxygen_flow', 'fio2', 'peep', 'tidal_volume', 'minute_ventilation', 'peak_pressure', 'plateau_pressure', 'ventilator_rate']);
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const instant = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
const micros = (v: string) => { const m = v.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:?\d{2})$/); if (!m)
    return null; const ms = Date.parse(`${m[1]}${m[3]}`); return Number.isFinite(ms) ? BigInt(ms) * 1000n + BigInt((m[2] ?? '').padEnd(6, '0')) : null; };
const sha = (v: unknown): v is string => typeof v === 'string' && /^sha256:[0-9a-f]{64}$/.test(v);
const text = (v: unknown, min = 0, max = 8000): v is string => typeof v === 'string' && v.trim().length >= min && v.length <= max;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) && [Object.prototype, null].includes(Object.getPrototypeOf(v));
const stable = (v: unknown): string => JSON.stringify(v, (_key, item: unknown) => object(item) ? Object.fromEntries(Object.keys(item).sort().map(k => [k, item[k]])) : item);
const deepFreeze = <T>(v: T): T => { if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const child of Object.values(v as Record<string, unknown>))
        deepFreeze(child);
} return v; };
const required = (value: string, label: string) => text(value, 3) ? null : `${label} muss als eigene tatsächliche Angabe dokumentiert werden.`;
const person = (v: string | null) => v === null || uuid(v);
const time = (v: string | null) => v === null || instant(v);
const strings = (v: unknown) => object(v) && Object.keys(v).length <= 40 && Object.entries(v).every(([k, s]) => text(k, 1, 80) && typeof s === 'string' && s.length <= 1000);
const numbers = (v: unknown) => object(v) && Object.keys(v).length > 0 && Object.keys(v).length <= 40 && Object.entries(v).every(([k, n]) => text(k, 1, 80) && typeof n === 'number' && Number.isFinite(n));
function refs(list: readonly RespiratoryCareRef[], limit = 4000) { return Array.isArray(list) && Object.keys(list).length === list.length && list.length <= limit && list.every(x => x && uuid(x.id) && Number.isSafeInteger(x.revision) && x.revision > 0 && instant(x.recordedAt) && sha(x.fingerprint) && uuid(x.tenantId) && uuid(x.clientId) && uuid(x.measurementId) && object(x.payload)) && new Set(list.map(x => x.id.toLowerCase())).size === list.length; }
export function respiratoryCareSourcesIssue(v: unknown): string | null { const s = v as RespiratoryCareSources; if (!s || !refs(s.measurements, 1) || s.measurements.length !== 1 || !refs(s.medicalOrders) || !refs(s.devices) || !refs(s.calibrations) || !refs(s.treatmentExecutions) || !refs(s.qualifications) || !refs(s.handovers) || !refs(s.people) || !refs(s.paths))
    return 'Messung, Verordnungen, Geräte, Ausführungen, Qualifikationen, Übergaben, Personen oder Atempfad sind abgeschnitten, doppelt oder ohne native Revision.'; return null; }
export function blankRespiratoryCareEntry(kind: RespiratoryCareKind, tenantId: string, clientId: string, measurementId: string, now = new Date().toISOString()): RespiratoryCareEntry { return { kind, title: '', tenantId, clientId, measurementId, observedAt: now, source: { measurementType: '', values: {}, unit: '', context: {}, medicalOrderId: null, deviceId: null, calibrationId: null }, oxygen: { prescribedFlow: '', actualFlow: '', application: '', device: '', occurredAt: null, performedBy: null }, tracheostomy: { cannulaType: '', care: '', changeBasis: '', skin: '', secretion: '', occurredAt: null, performedBy: null }, suction: { reason: '', route: '', secretion: '', execution: '', tolerance: '', occurredAt: null, performedBy: null, followUp: '' }, ventilation: { mode: '', prescribedSettings: {}, actualSettings: {}, occurredAt: null, reviewedBy: null, deviation: '' }, alarm: { label: '', beganAt: null, acknowledgedAt: null, reaction: '', cause: '', resolvedAt: null, control: '', responsibleBy: null }, equipment: { required: '', present: '', missing: '', functionCheckAt: null, functionResult: '', responsibleBy: null, resolvedAt: null }, qualification: { requirement: '', qualificationId: null, evidence: '', validUntil: null, instruction: '', reviewedBy: null, eligible: 'unknown' }, handover: { careProfile: '', monitoring: '', pending: '', recipient: '', handedOverAt: null, handedOverBy: null, specialistApproval: 'not_requested', approvedBy: null, approvedAt: null }, correction: { targetId: null, reason: '', replacementId: null, approvedBy: null, approvedAt: null } }; }
function phaseIssue(e: RespiratoryCareEntry): string | null {
    const by = e.kind;
    if (by === 'oxygen_support')
        return required(e.oxygen.prescribedFlow, 'Verordneter Sauerstofffluss') ?? required(e.oxygen.actualFlow, 'Tatsächlicher Sauerstofffluss') ?? required(e.oxygen.application, 'Applikationsform') ?? required(e.oxygen.device, 'Tatsächlich verwendetes Gerät') ?? (!time(e.oxygen.occurredAt) || !person(e.oxygen.performedBy) || !e.oxygen.occurredAt || !e.oxygen.performedBy ? 'Sauerstoffgabe benötigt tatsächlichen Zeitpunkt und ausführende Person.' : null);
    if (by === 'tracheostomy_care')
        return required(e.tracheostomy.cannulaType, 'Kanülentyp') ?? required(e.tracheostomy.care, 'Tatsächliche Versorgung') ?? required(e.tracheostomy.changeBasis, 'Wechselgrundlage') ?? required(e.tracheostomy.skin, 'Hautbefund') ?? required(e.tracheostomy.secretion, 'Sekretbeobachtung') ?? (!e.tracheostomy.occurredAt || !instant(e.tracheostomy.occurredAt) || !uuid(e.tracheostomy.performedBy) ? 'Tracheostomaversorgung benötigt tatsächlichen Zeitpunkt und ausführende Person.' : null);
    if (by === 'suction')
        return required(e.suction.reason, 'Absauggrund') ?? required(e.suction.route, 'Absaugweg') ?? required(e.suction.secretion, 'Sekretbeobachtung') ?? required(e.suction.execution, 'Tatsächliche Durchführung') ?? required(e.suction.tolerance, 'Tatsächliche Verträglichkeit') ?? required(e.suction.followUp, 'Erforderliche Nachbeobachtung') ?? (!e.suction.occurredAt || !instant(e.suction.occurredAt) || !uuid(e.suction.performedBy) ? 'Absaugung benötigt tatsächlichen Zeitpunkt und ausführende Person.' : null);
    if (by === 'ventilation_review')
        return required(e.ventilation.mode, 'Beatmungsmodus') ?? (!strings(e.ventilation.prescribedSettings) || !Object.keys(e.ventilation.prescribedSettings).length || !strings(e.ventilation.actualSettings) || !Object.keys(e.ventilation.actualSettings).length ? 'Verordnete und tatsächlich beobachtete Beatmungswerte müssen getrennt vollständig vorliegen.' : !e.ventilation.occurredAt || !instant(e.ventilation.occurredAt) || !uuid(e.ventilation.reviewedBy) ? 'Beatmungsabgleich benötigt tatsächlichen Zeitpunkt und prüfende Person.' : required(e.ventilation.deviation, 'Abweichungsbewertung'));
    if (by === 'alarm_response')
        return required(e.alarm.label, 'Alarm') ?? (!e.alarm.beganAt || !instant(e.alarm.beganAt) || !e.alarm.acknowledgedAt || !instant(e.alarm.acknowledgedAt) || !uuid(e.alarm.responsibleBy) ? 'Alarm benötigt Beginn, Quittierungszeit und verantwortliche Person.' : required(e.alarm.reaction, 'Tatsächliche Reaktion') ?? required(e.alarm.cause, 'Tatsächliche oder offene Ursache') ?? (e.alarm.resolvedAt && !text(e.alarm.control, 3) ? 'Alarmabschluss benötigt eine tatsächliche Kontrolle; Quittierung allein genügt nicht.' : e.alarm.resolvedAt && !instant(e.alarm.resolvedAt) ? 'Alarmabschlusszeit ist ungültig.' : null));
    if (by === 'emergency_equipment')
        return required(e.equipment.required, 'Erforderliche Notfallausstattung') ?? required(e.equipment.present, 'Vorhandene Ausstattung') ?? (!e.equipment.functionCheckAt || !instant(e.equipment.functionCheckAt) || !uuid(e.equipment.responsibleBy) ? 'Notfallausstattung benötigt tatsächliche Funktionsprüfung und verantwortliche Person.' : required(e.equipment.functionResult, 'Tatsächliches Prüfergebnis') ?? (text(e.equipment.missing, 1) && e.equipment.resolvedAt === null ? 'Fehlende Notfallausstattung bleibt bis zur bestätigten Behebung offen.' : e.equipment.resolvedAt && !instant(e.equipment.resolvedAt) ? 'Behebungszeit ist ungültig.' : null));
    if (by === 'qualification_review')
        return required(e.qualification.requirement, 'Qualifikationsanforderung') ?? (!uuid(e.qualification.qualificationId) || !uuid(e.qualification.reviewedBy) ? 'Qualifikationsprüfung benötigt Originalnachweis und prüfende Person.' : required(e.qualification.evidence, 'Qualifikationsnachweis') ?? required(e.qualification.instruction, 'Einweisung') ?? (!e.qualification.validUntil || !instant(e.qualification.validUntil) ? 'Qualifikationsnachweis benötigt seine tatsächliche Gültigkeit.' : e.qualification.eligible === 'unknown' ? 'Eignung muss ausdrücklich als geeignet oder nicht geeignet entschieden werden.' : null));
    if (by === 'intensive_handover')
        return required(e.handover.careProfile, 'Intensivpflegeprofil') ?? required(e.handover.monitoring, 'Überwachung') ?? required(e.handover.pending, 'Offene Punkte') ?? required(e.handover.recipient, 'Tatsächliche Übergabeempfänger:in') ?? (!e.handover.handedOverAt || !instant(e.handover.handedOverAt) || !uuid(e.handover.handedOverBy) ? 'Übergabe benötigt tatsächlichen Zeitpunkt und übergebende Person.' : e.handover.specialistApproval === 'approved' && (!uuid(e.handover.approvedBy) || !instant(e.handover.approvedAt)) ? 'Spezialisierte Freigabe benötigt eigene Person und tatsächlichen Zeitpunkt.' : e.handover.specialistApproval !== 'approved' && (e.handover.approvedBy !== null || e.handover.approvedAt !== null) ? 'Ohne spezialisierte Freigabe dürfen keine Freigabeoriginale gesetzt sein.' : null);
    if (by === 'correction')
        return !uuid(e.correction.targetId) || !text(e.correction.reason, 10) || !uuid(e.correction.replacementId) || e.correction.targetId === e.correction.replacementId || !uuid(e.correction.approvedBy) || !instant(e.correction.approvedAt) ? 'Korrektur benötigt historisches Original, begründeten Nachtrag, neue Identität und aktuelle Freigabe.' : null;
    return null;
}
export function respiratoryCareEntryIssue(v: unknown): string | null { const e = v as RespiratoryCareEntry; if (!e || !respiratoryKinds.has(e.kind) || !text(e.title, 3, 300) || ![e.tenantId, e.clientId, e.measurementId].every(uuid) || !instant(e.observedAt) || !e.source || !numbers(e.source.values) || !strings(e.source.context) || !text(e.source.measurementType, 1, 100) || !text(e.source.unit, 1, 40))
    return 'Atem-/Intensivpflegepfad ist nicht vollständig an Mandant, Pflegefall, Messung und tatsächliche Beobachtungszeit gebunden.'; if (!respiratoryMeasurementTypes.has(e.source.measurementType))
    return 'Der Ausgangswert ist keine ausdrücklich unterstützte Atem- oder Beatmungsmessung.'; if (!person(e.source.medicalOrderId) || !person(e.source.deviceId) || !person(e.source.calibrationId) || e.source.calibrationId && !e.source.deviceId)
    return 'Verordnung, Gerät oder Kalibrierung ist ungültig gebunden.'; for (const [at, by] of [[e.oxygen.occurredAt, e.oxygen.performedBy], [e.tracheostomy.occurredAt, e.tracheostomy.performedBy], [e.suction.occurredAt, e.suction.performedBy], [e.ventilation.occurredAt, e.ventilation.reviewedBy], [e.alarm.beganAt, e.alarm.responsibleBy], [e.equipment.functionCheckAt, e.equipment.responsibleBy], [e.handover.handedOverAt, e.handover.handedOverBy]] as const)
    if ((at !== null && !instant(at)) || (by !== null && !uuid(by)) || at && micros(at)! < micros(e.observedAt)!)
        return 'Tatsächliche Handlung oder Prüfung darf nicht vor dem Ausgangswert liegen und benötigt gültige Identität.'; if (e.kind !== 'correction' && Object.values(e.correction).some(x => x !== null && x !== ''))
    return 'Nur ein Korrekturvorgang darf Korrekturfelder setzen.'; return phaseIssue(e); }
export function respiratoryCareOriginalIssue(v: unknown, c: {
    tenantId: string;
    clientId: string;
    measurementId: string;
}): string | null { const o = v as RespiratoryCareOriginal; if (!o || ![o.id, o.rootId, o.headId, o.recordedBy].every(uuid) || o.tenantId !== c.tenantId || o.clientId !== c.clientId || o.measurementId !== c.measurementId || !Number.isSafeInteger(o.revision) || o.revision < 1 || !instant(o.recordedAt) || !sha(o.contentFingerprint) || !Array.isArray(o.history) || o.history.length !== o.revision || o.history.length > 2000)
    return 'Atem-/Intensivpflegehistorie fehlt, ist abgeschnitten oder fremd.'; for (let n = 0; n < o.history.length; n++) {
    const h = o.history[n], previous = n ? o.history[n - 1].id : null;
    if (!uuid(h.id) || h.revision !== n + 1 || h.previousId !== previous || !instant(h.recordedAt) || !uuid(h.recordedBy) || !text(h.recordedByName, 1) || !sha(h.contentFingerprint) || respiratoryCareEntryIssue(h.payload))
        return 'Atem-/Intensivpflegehistorie besitzt eine Lücke oder ungültigen Inhalt.';
} const h = o.history.at(-1)!; return o.id !== h.id || o.headId !== h.id || o.revision !== h.revision || o.kind !== h.payload.kind || stable(o.payload) !== stable(h.payload) ? 'Atem-/Intensivpflegekopf widerspricht der Historie.' : null; }
export function respiratoryCarePacketIssue(v: unknown): string | null { const p = v as RespiratoryCarePacket; if (!p || p.schemaVersion !== '1' || !['create', 'revise'].includes(p.action) || ![p.requestId, p.tenantId, p.clientId, p.measurementId, p.actorId].every(uuid) || p.entry?.tenantId !== p.tenantId || p.entry.clientId !== p.clientId || p.entry.measurementId !== p.measurementId)
    return 'Paketidentität oder Messungsbindung ist ungültig.'; const issue = respiratoryCareSourcesIssue(p.sources) ?? respiratoryCareEntryIssue(p.entry); if (issue)
    return issue; const m = p.sources.measurements[0]; if (m.id !== p.measurementId || m.tenantId !== p.tenantId || m.clientId !== p.clientId || String(m.payload.occurred_at) !== p.entry.observedAt || String(m.payload.vital_key) !== p.entry.source.measurementType || String(m.payload.unit) !== p.entry.source.unit || stable(m.payload.values) !== stable(p.entry.source.values) || stable(m.payload.context) !== stable(p.entry.source.context))
    return 'Atemmessung, Zeitpunkt, Einheit oder Messsituation stimmen nicht vollständig mit dem nativen Original überein.'; const own = (list: readonly RespiratoryCareRef[], id: string | null) => id === null ? null : list.find(x => x.id === id && x.tenantId === p.tenantId && x.clientId === p.clientId); if (p.entry.source.medicalOrderId && !own(p.sources.medicalOrders, p.entry.source.medicalOrderId))
    return 'Ausgewählte medizinische Verordnung fehlt im vollständigen aktuellen Bestand.'; if (p.entry.source.deviceId && !own(p.sources.devices, p.entry.source.deviceId) || p.entry.source.calibrationId && !own(p.sources.calibrations, p.entry.source.calibrationId))
    return 'Geräte-/Kalibrierungsoriginal fehlt im vollständigen aktuellen Bestand.'; const ids = [p.entry.oxygen.performedBy, p.entry.tracheostomy.performedBy, p.entry.suction.performedBy, p.entry.ventilation.reviewedBy, p.entry.alarm.responsibleBy, p.entry.equipment.responsibleBy, p.entry.qualification.reviewedBy, p.entry.handover.handedOverBy, p.entry.handover.approvedBy].filter((x): x is string => !!x); if (ids.some(id => !p.sources.people.some(x => x.id === id && x.payload.active === true)))
    return 'Verantwortliche Person fehlt im aktuellen aktiven Personenbestand.'; if (p.entry.qualification.qualificationId) {
    const q = own(p.sources.qualifications, p.entry.qualification.qualificationId);
    if (!q || String(q.payload.valid_until) !== p.entry.qualification.validUntil || q.payload.revoked === true)
        return 'Qualifikationsnachweis, Gültigkeit oder Widerruf stimmt nicht mit dem Original überein.';
} if (p.entry.kind === 'correction' && (!own(p.sources.paths, p.entry.correction.targetId) || p.entry.correction.approvedBy !== p.actorId || p.entry.correction.replacementId !== p.requestId))
    return 'Korrektur ist nicht an Original, aktuelle Sitzung und Anfrageidentität gebunden.'; if (p.action === 'create') {
    if (p.original !== null || p.expectedHeadId !== null || p.expectedRevision !== 0 || p.reason)
        return 'Neuanlage darf keinen historischen Kopf vortäuschen.';
}
else {
    const historical = p.original ? respiratoryCareOriginalIssue(p.original, p) : 'Historisches Original fehlt.';
    if (historical)
        return historical;
    if (p.expectedHeadId !== p.original!.headId || p.expectedRevision !== p.original!.revision || !text(p.reason, 10) || stable(p.entry) === stable(p.original!.payload))
        return 'Fortschreibung benötigt aktuellen CAS-Kopf, konkreten Grund und echte Änderung.';
} return null; }
export function makeRespiratoryCarePacket(v: RespiratoryCarePacket): RespiratoryCarePacket { const captured = structuredClone(v), issue = respiratoryCarePacketIssue(captured); if (issue)
    throw Error(issue); return deepFreeze(captured); }
