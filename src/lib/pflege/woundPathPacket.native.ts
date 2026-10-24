// Generated native presentation from src/lib/pflege/woundPathPacket.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
export type WoundPathKind = 'infection_suspicion' | 'clinical_contact' | 'clinical_response' | 'escalation_resolution' | 'reopen_escalation' | 'correction';
export type WoundPathRef = Readonly<{
    id: string;
    revision: number;
    recordedAt: string;
    fingerprint: string;
    clientId: string;
    woundId: string;
    payload: Record<string, unknown>;
}>;
export type WoundPathSources = Readonly<{
    wounds: readonly WoundPathRef[];
    assessments: readonly WoundPathRef[];
    photos: readonly WoundPathRef[];
    photoConsents: readonly WoundPathRef[];
    plans: readonly WoundPathRef[];
    dressings: readonly WoundPathRef[];
    contacts: readonly WoundPathRef[];
    lifecycle: readonly WoundPathRef[];
    people: readonly WoundPathRef[];
    corrections: readonly WoundPathRef[];
    escalations: readonly WoundPathRef[];
}>;
export type WoundPathEntry = Readonly<{
    kind: WoundPathKind;
    title: string;
    tenantId: string;
    clientId: string;
    woundId: string;
    observedAt: string;
    observation: Readonly<{
        state: 'suspected' | 'ruled_out' | 'unclear';
        signs: readonly string[];
        narrative: string;
        assessmentId: string | null;
        photoId: string | null;
        photoConsentId: string | null;
    }>;
    contact: Readonly<{
        state: 'pending' | 'attempted' | 'reached' | 'responded';
        channel: string;
        contactedAt: string | null;
        contactName: string;
        responseAt: string | null;
        response: string;
        nextStep: string;
        responsibleBy: string | null;
    }>;
    care: Readonly<{
        planId: string | null;
        dressingId: string | null;
        outcome: 'none' | 'performed' | 'partial' | 'omitted' | 'refused' | 'failed';
        occurredAt: string | null;
        action: string;
        reason: string;
    }>;
    person: Readonly<{
        decision: string;
        informedAt: string | null;
        photoDecision: 'not_applicable' | 'pending' | 'consented' | 'declined';
    }>;
    resolution: Readonly<{
        state: 'open' | 'monitoring' | 'resolved' | 'reopened';
        resolvedAt: string | null;
        result: string;
        followUpAt: string | null;
        responsibleBy: string | null;
    }>;
    correction: Readonly<{
        targetId: string | null;
        reason: string;
        replacementId: string | null;
        approvedBy: string | null;
        approvedAt: string | null;
    }>;
}>;
export type WoundPathHistoryItem = Readonly<{
    id: string;
    revision: number;
    previousId: string | null;
    recordedAt: string;
    recordedBy: string;
    recordedByName: string;
    reason: string;
    payload: WoundPathEntry;
    contentFingerprint: string;
}>;
export type WoundPathOriginal = Readonly<{
    id: string;
    tenantId: string;
    clientId: string;
    woundId: string;
    rootId: string;
    headId: string;
    revision: number;
    kind: WoundPathKind;
    recordedAt: string;
    recordedBy: string;
    recordedByName: string;
    payload: WoundPathEntry;
    contentFingerprint: string;
    history: readonly WoundPathHistoryItem[];
}>;
export type WoundPathPacket = Readonly<{
    schemaVersion: '1';
    action: 'create' | 'revise';
    requestId: string;
    tenantId: string;
    clientId: string;
    woundId: string;
    actorId: string;
    expectedHeadId: string | null;
    expectedRevision: number;
    entry: WoundPathEntry;
    reason: string;
    original: WoundPathOriginal | null;
    sources: WoundPathSources;
}>;
const kinds = new Set<WoundPathKind>(['infection_suspicion', 'clinical_contact', 'clinical_response', 'escalation_resolution', 'reopen_escalation', 'correction']);
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const instant = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
const micros = (v: string) => { const m = v.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:?\d{2})$/); if (!m)
    return null; const ms = Date.parse(`${m[1]}${m[3]}`); return Number.isFinite(ms) ? BigInt(ms) * 1000n + BigInt((m[2] ?? '').padEnd(6, '0')) : null; };
const text = (v: unknown, min = 0, max = 8000): v is string => typeof v === 'string' && v.trim().length >= min && v.length <= max;
const sha = (v: unknown): v is string => typeof v === 'string' && /^sha256:[0-9a-f]{64}$/.test(v);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const stable = (v: unknown) => JSON.stringify(v, (_key, item: unknown) => object(item) ? Object.fromEntries(Object.keys(item).sort().map(k => [k, item[k]])) : item);
const deepFreeze = <T>(v: T): T => { if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const child of Object.values(v as Record<string, unknown>))
        deepFreeze(child);
} return v; };
function refs(list: readonly WoundPathRef[], limit = 4000) { return Array.isArray(list) && Object.keys(list).length === list.length && list.length <= limit && list.every(x => x && uuid(x.id) && Number.isSafeInteger(x.revision) && x.revision > 0 && instant(x.recordedAt) && sha(x.fingerprint) && uuid(x.clientId) && uuid(x.woundId) && object(x.payload)) && new Set(list.map(x => x.id.toLowerCase())).size === list.length; }
export function blankWoundPathEntry(kind: WoundPathKind, tenantId: string, clientId: string, woundId: string, now = new Date().toISOString()): WoundPathEntry { return { kind, title: '', tenantId, clientId, woundId, observedAt: now, observation: { state: 'unclear', signs: [], narrative: '', assessmentId: null, photoId: null, photoConsentId: null }, contact: { state: 'pending', channel: '', contactedAt: null, contactName: '', responseAt: null, response: '', nextStep: '', responsibleBy: null }, care: { planId: null, dressingId: null, outcome: 'none', occurredAt: null, action: '', reason: '' }, person: { decision: '', informedAt: null, photoDecision: 'not_applicable' }, resolution: { state: 'open', resolvedAt: null, result: '', followUpAt: null, responsibleBy: null }, correction: { targetId: null, reason: '', replacementId: null, approvedBy: null, approvedAt: null } }; }
export function woundPathSourcesIssue(v: unknown): string | null { const s = v as WoundPathSources; if (!s || !refs(s.wounds, 2) || !refs(s.assessments) || !refs(s.photos) || !refs(s.photoConsents) || !refs(s.plans) || !refs(s.dressings) || !refs(s.contacts) || !refs(s.lifecycle) || !refs(s.people) || !refs(s.corrections) || !refs(s.escalations))
    return 'Wund-, Befund-, Bild-, Plan-, Versorgungs-, Kontakt-, Personen- oder Statusquellen sind abgeschnitten, doppelt oder ohne native Revision.'; return null; }
export function woundPathEntryIssue(v: unknown): string | null {
    const e = v as WoundPathEntry;
    if (!e || !kinds.has(e.kind) || !text(e.title, 3, 300) || ![e.tenantId, e.clientId, e.woundId].every(uuid) || !instant(e.observedAt) || !e.observation || !e.contact || !e.care || !e.person || !e.resolution || !e.correction)
        return 'Wundpfad ist nicht vollständig an Mandant, Pflegefall, Wunde und Beobachtungszeit gebunden.';
    const o = e.observation;
    if (!['suspected', 'ruled_out', 'unclear'].includes(o.state) || !Array.isArray(o.signs) || o.signs.length > 30 || o.signs.some(x => !text(x, 1, 200)) || new Set(o.signs.map(x => x.trim().toLowerCase())).size !== o.signs.length || !text(o.narrative, 3) || o.assessmentId !== null && !uuid(o.assessmentId) || o.photoId !== null && !uuid(o.photoId) || o.photoConsentId !== null && !uuid(o.photoConsentId))
        return 'Beobachtung benötigt einen ausdrücklichen Einschätzungsstand, konkrete Zeichen, Text und gültige Originalbezüge.';
    if (o.state === 'suspected' && o.signs.length === 0)
        return 'Infektionsverdacht benötigt mindestens ein tatsächlich beobachtetes Zeichen; daraus wird keine Diagnose abgeleitet.';
    if (o.photoId !== null && (o.photoConsentId === null || e.person.photoDecision !== 'consented'))
        return 'Ein Foto darf nur mit ausdrücklich zugeordnetem Einwilligungsoriginal verwendet werden.';
    const c = e.contact;
    if (!['pending', 'attempted', 'reached', 'responded'].includes(c.state) || !text(c.nextStep, 3) || c.responsibleBy !== null && !uuid(c.responsibleBy))
        return 'Kontaktstatus, nächster Schritt und verantwortliche Person müssen ausdrücklich dokumentiert sein.';
    if (c.state === 'pending' && (c.contactedAt !== null || c.responseAt !== null || c.channel || c.contactName || c.response))
        return 'Offener Kontakt darf keinen tatsächlichen Versuch oder eine Rückmeldung vortäuschen.';
    if (['attempted', 'reached', 'responded'].includes(c.state) && (!instant(c.contactedAt) || !text(c.channel, 1) || !text(c.contactName, 1) || !uuid(c.responsibleBy)))
        return 'Tatsächlicher Kontaktversuch benötigt Zeitpunkt, Kanal, Gegenstelle und verantwortliche Person.';
    if (c.state === 'responded' && (!instant(c.responseAt) || !text(c.response, 3) || micros(c.responseAt!)! < micros(c.contactedAt!)!))
        return 'Tatsächliche Rückmeldung benötigt Inhalt und einen Zeitpunkt nach dem Kontakt.';
    if (c.state !== 'responded' && (c.responseAt !== null || c.response))
        return 'Ohne bestätigte Rückmeldung dürfen weder Antwortzeit noch Antwortinhalt gesetzt sein.';
    const care = e.care;
    if (!['none', 'performed', 'partial', 'omitted', 'refused', 'failed'].includes(care.outcome) || care.planId !== null && !uuid(care.planId) || care.dressingId !== null && !uuid(care.dressingId))
        return 'Versorgungsbezug ist ungültig.';
    if (care.outcome === 'none' && (care.occurredAt !== null || care.dressingId !== null || care.action))
        return 'Beobachtung, Kontakt oder Plan darf keine tatsächliche Versorgung vortäuschen.';
    if (care.outcome !== 'none' && (!instant(care.occurredAt) || !uuid(care.dressingId) || !text(care.action, 3) || !text(care.reason, 3)))
        return 'Tatsächliche Versorgung oder Nichtdurchführung benötigt Original, Zeitpunkt, Handlung und Begründung.';
    if (!text(e.person.decision, 3) || e.person.informedAt !== null && !instant(e.person.informedAt) || !['not_applicable', 'pending', 'consented', 'declined'].includes(e.person.photoDecision))
        return 'Entscheidung der betroffenen Person und Bildentscheidung müssen getrennt dokumentiert sein.';
    const r = e.resolution;
    if (!['open', 'monitoring', 'resolved', 'reopened'].includes(r.state) || r.responsibleBy !== null && !uuid(r.responsibleBy) || r.followUpAt !== null && !instant(r.followUpAt))
        return 'Eskalationsstatus, Kontrolle und Verantwortung sind ungültig.';
    if (r.state === 'resolved' && (!instant(r.resolvedAt) || !text(r.result, 3) || !uuid(r.responsibleBy) || c.state !== 'responded'))
        return 'Abschluss benötigt tatsächliche Rückmeldung, Ergebnis, Zeitpunkt und Verantwortung.';
    if (r.state !== 'resolved' && (r.resolvedAt !== null || r.result))
        return 'Offene, überwachte oder wiedereröffnete Eskalation darf keinen Abschluss vortäuschen.';
    if (r.state === 'monitoring' && (!instant(r.followUpAt) || !uuid(r.responsibleBy)))
        return 'Überwachung benötigt tatsächlichen Kontrolltermin und Verantwortung.';
    if (e.kind === 'correction' && (!uuid(e.correction.targetId) || !text(e.correction.reason, 10) || !uuid(e.correction.replacementId) || e.correction.targetId === e.correction.replacementId || !uuid(e.correction.approvedBy) || !instant(e.correction.approvedAt)))
        return 'Korrektur benötigt historisches Original, begründeten Nachtrag, neue Identität und aktuelle Freigabe.';
    if (e.kind !== 'correction' && Object.values(e.correction).some(x => x !== null && x !== ''))
        return 'Nur ein Korrekturvorgang darf Korrekturfelder setzen.';
    if (e.kind === 'infection_suspicion' && o.state !== 'suspected' || e.kind === 'clinical_contact' && c.state === 'pending' || e.kind === 'clinical_response' && c.state !== 'responded' || e.kind === 'escalation_resolution' && r.state !== 'resolved' || e.kind === 'reopen_escalation' && r.state !== 'reopened')
        return 'Vorgangsart und tatsächlicher Beobachtungs-, Kontakt- oder Abschlussstatus widersprechen sich.';
    return null;
}
export function woundPathOriginalIssue(v: unknown, c: {
    tenantId: string;
    clientId: string;
    woundId: string;
}): string | null { const o = v as WoundPathOriginal; if (!o || ![o.id, o.rootId, o.headId, o.recordedBy].every(uuid) || o.tenantId !== c.tenantId || o.clientId !== c.clientId || o.woundId !== c.woundId || !kinds.has(o.kind) || !Number.isSafeInteger(o.revision) || o.revision < 1 || !instant(o.recordedAt) || !sha(o.contentFingerprint) || !Array.isArray(o.history) || Object.keys(o.history).length !== o.history.length || o.history.length !== o.revision || o.history.length > 2000)
    return 'Wundpfadhistorie fehlt, ist abgeschnitten oder fremd.'; for (let n = 0; n < o.history.length; n++) {
    const h = o.history[n], previous = n === 0 ? null : o.history[n - 1].id;
    if (!uuid(h.id) || h.revision !== n + 1 || h.previousId !== previous || !instant(h.recordedAt) || !uuid(h.recordedBy) || !text(h.recordedByName, 1) || !sha(h.contentFingerprint) || woundPathEntryIssue(h.payload))
        return 'Wundpfadhistorie besitzt eine Lücke oder ungültigen Inhalt.';
} const h = o.history.at(-1)!; return o.id !== h.id || o.headId !== h.id || o.revision !== h.revision || o.kind !== h.payload.kind || o.recordedAt !== h.recordedAt || o.recordedBy !== h.recordedBy || o.recordedByName !== h.recordedByName || o.contentFingerprint !== h.contentFingerprint || stable(o.payload) !== stable(h.payload) ? 'Wundpfad-Originalkopf widerspricht der Historie.' : null; }
export function woundPathPacketIssue(v: unknown): string | null {
    const p = v as WoundPathPacket;
    if (!p || p.schemaVersion !== '1' || !['create', 'revise'].includes(p.action) || ![p.requestId, p.tenantId, p.clientId, p.woundId, p.actorId].every(uuid) || p.entry?.tenantId !== p.tenantId || p.entry.clientId !== p.clientId || p.entry.woundId !== p.woundId)
        return 'Paketidentität oder Wundbindung ist ungültig.';
    const sourceIssue = woundPathSourcesIssue(p.sources), entryIssue = woundPathEntryIssue(p.entry);
    if (sourceIssue || entryIssue)
        return sourceIssue ?? entryIssue;
    const wound = p.sources.wounds.find(x => x.id === p.woundId);
    if (!wound || wound.clientId !== p.clientId || !['draft', 'active', 'healing', 'healed', 'deteriorated', 'archived'].includes(String(wound.payload.status)))
        return 'Aktueller nativer Wundfall fehlt oder ist fremd.';
    const own = (list: readonly WoundPathRef[], id: string | null) => id === null ? null : list.find(x => x.id === id && x.clientId === p.clientId && x.woundId === p.woundId);
    if (p.entry.observation.assessmentId && !own(p.sources.assessments, p.entry.observation.assessmentId))
        return 'Ausgewähltes Assessment fehlt im vollständigen Wundbestand.';
    if (p.entry.observation.photoId) {
        const photo = own(p.sources.photos, p.entry.observation.photoId), consent = own(p.sources.photoConsents, p.entry.observation.photoConsentId);
        if (!photo || !consent || photo.payload.assessment_id !== p.entry.observation.assessmentId || consent.payload.status !== 'active' || photo.payload.consent_id !== consent.id)
            return 'Foto ist nicht unverändert an Wunde, Befund und aktive Einwilligung gebunden.';
    }
    if (p.entry.care.planId && !own(p.sources.plans, p.entry.care.planId))
        return 'Gewählte Planfassung fehlt im vollständigen Wundbestand.';
    if (p.entry.care.dressingId) {
        const d = own(p.sources.dressings, p.entry.care.dressingId);
        if (!d || d.payload.plan_id !== p.entry.care.planId || String(d.payload.outcome ?? '') !== p.entry.care.outcome || String(d.payload.occurred_at ?? '') !== p.entry.care.occurredAt)
            return 'Versorgungsoriginal oder sein Planbezug wurde verändert.';
    }
    if (p.entry.contact.responsibleBy && !p.sources.people.some(x => x.id === p.entry.contact.responsibleBy && x.clientId === p.clientId && x.payload.active === true))
        return 'Verantwortliche Person ist nicht im aktuellen vollständigen Personenbestand.';
    if (p.entry.resolution.responsibleBy && !p.sources.people.some(x => x.id === p.entry.resolution.responsibleBy && x.payload.active === true))
        return 'Abschlussverantwortung ist nicht im aktuellen Personenbestand.';
    if (p.entry.kind === 'reopen_escalation' && !p.sources.escalations.some(x => x.payload.resolution_state === 'resolved'))
        return 'Wiederöffnung benötigt einen tatsächlich abgeschlossenen historischen Eskalationsverlauf.';
    if (p.entry.kind === 'correction' && (!own(p.sources.escalations, p.entry.correction.targetId) || p.entry.correction.approvedBy !== p.actorId || p.entry.correction.replacementId !== p.requestId))
        return 'Korrektur ist nicht an Original, aktuelle Sitzung und Anfrageidentität gebunden.';
    if (p.action === 'create') {
        if (p.original !== null || p.expectedHeadId !== null || p.expectedRevision !== 0 || p.reason)
            return 'Neuanlage darf keinen historischen Kopf vortäuschen.';
    }
    else {
        const issue = p.original ? woundPathOriginalIssue(p.original, p) : 'Historisches Original fehlt.';
        if (issue)
            return issue;
        if (p.expectedHeadId !== p.original!.headId || p.expectedRevision !== p.original!.revision || !text(p.reason, 10) || stable(p.entry) === stable(p.original!.payload))
            return 'Fortschreibung benötigt aktuellen CAS-Kopf, konkreten Grund und echte Änderung.';
    }
    return null;
}
export function makeWoundPathPacket(v: WoundPathPacket): WoundPathPacket { const captured = structuredClone(v), issue = woundPathPacketIssue(captured); if (issue)
    throw Error(issue); return deepFreeze(captured); }
