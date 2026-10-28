// Generated native presentation from src/lib/pflege/treatmentCarePacket.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
export type TreatmentCareKind = 'order_review' | 'payer_review' | 'injection' | 'insulin' | 'infusion' | 'pump' | 'inhalation' | 'instillation' | 'compression' | 'access_drain' | 'other_hkp' | 'order_revision' | 'measurement_link' | 'completion_review' | 'correction';
export type TreatmentCareRef = Readonly<{
    id: string;
    revision: number;
    recordedAt: string;
    fingerprint: string;
    clientId: string;
    orderId: string | null;
    payload: Record<string, unknown>;
}>;
export type TreatmentCareSources = Readonly<{
    orders: readonly TreatmentCareRef[];
    approvals: readonly TreatmentCareRef[];
    executions: readonly TreatmentCareRef[];
    infusions: readonly TreatmentCareRef[];
    measurements: readonly TreatmentCareRef[];
    invalidations: readonly TreatmentCareRef[];
    corrections: readonly TreatmentCareRef[];
    people: readonly TreatmentCareRef[];
    documents: readonly TreatmentCareRef[];
}>;
export type TreatmentCareEntry = Readonly<{
    kind: TreatmentCareKind;
    title: string;
    plannedAt: string;
    occurredAt: string | null;
    clientId: string;
    orderId: string;
    orderVersion: string;
    order: Readonly<{
        status: 'draft' | 'active' | 'paused' | 'stopped' | 'expired';
        validFrom: string;
        validUntil: string | null;
        prescriber: string;
        scope: string;
        instructions: string;
        revisionReason: string;
        previousOrderId: string | null;
    }>;
    payer: Readonly<{
        state: 'not_required' | 'pending' | 'approved' | 'partially_approved' | 'rejected' | 'unknown';
        approvalId: string | null;
        reference: string;
        validFrom: string | null;
        validUntil: string | null;
        decisionNote: string;
    }>;
    execution: Readonly<{
        treatmentType: 'none' | 'injection' | 'insulin' | 'infusion' | 'pump' | 'inhalation' | 'instillation' | 'compression' | 'access_drain' | 'other_hkp';
        outcome: 'planned' | 'performed' | 'partial' | 'omitted' | 'refused' | 'failed';
        action: string;
        substance: string;
        amount: string | null;
        unit: string;
        route: string;
        site: string;
        device: string;
        observation: string;
        deviation: string;
    }>;
    material: Readonly<{
        state: 'not_required' | 'selected' | 'used' | 'unavailable';
        originalId: string | null;
        name: string;
        batch: string;
        expiresOn: string | null;
        quantity: string | null;
        unit: string;
        purpose: string;
        reason: string;
    }>;
    qualification: Readonly<{
        state: 'unconfirmed' | 'documented' | 'independently_confirmed';
        performedBy: string | null;
        reviewedBy: string | null;
        evidence: string;
        delegation: string;
    }>;
    measurement: Readonly<{
        state: 'not_required' | 'unconfirmed' | 'linked';
        measurementId: string | null;
        kind: string;
        value: string;
        unit: string;
        occurredAt: string | null;
        maximumAgeMinutes: string | null;
        reason: string;
    }>;
    infusion: Readonly<{
        state: 'not_applicable' | 'unconfirmed' | 'linked';
        courseId: string | null;
        headId: string | null;
        sequence: number | null;
        deviceMode: 'none' | 'gravity' | 'pump';
        rateMlHour: string | null;
        deliveredMl: string | null;
        remainingMl: string | null;
        sourceNote: string;
    }>;
    followUp: Readonly<{
        state: 'not_required' | 'pending' | 'scheduled' | 'completed';
        scheduledAt: string | null;
        completedAt: string | null;
        responsibleBy: string | null;
        communication: string;
        personDecision: string;
        result: string;
    }>;
    correction: Readonly<{
        targetId: string | null;
        reason: string;
        replacementId: string | null;
        approvedBy: string | null;
        approvedAt: string | null;
    }>;
    lifecycle: 'open' | 'completed';
}>;
export type TreatmentCareHistoryItem = Readonly<{
    id: string;
    revision: number;
    previousId: string | null;
    recordedAt: string;
    recordedBy: string;
    recordedByName: string;
    reason: string;
    payload: TreatmentCareEntry;
    contentFingerprint: string;
}>;
export type TreatmentCareOriginal = Readonly<{
    id: string;
    tenantId: string;
    clientId: string;
    orderId: string;
    rootId: string;
    headId: string;
    revision: number;
    kind: TreatmentCareKind;
    recordedAt: string;
    recordedBy: string;
    recordedByName: string;
    payload: TreatmentCareEntry;
    contentFingerprint: string;
    history: readonly TreatmentCareHistoryItem[];
    voided: boolean;
}>;
export type TreatmentCarePacket = Readonly<{
    schemaVersion: '1';
    action: 'create' | 'revise';
    requestId: string;
    tenantId: string;
    clientId: string;
    orderId: string;
    actorId: string;
    expectedHeadId: string | null;
    expectedRevision: number;
    entry: TreatmentCareEntry;
    reason: string;
    original: TreatmentCareOriginal | null;
    sources: TreatmentCareSources;
}>;
const kinds = new Set<TreatmentCareKind>(['order_review', 'payer_review', 'injection', 'insulin', 'infusion', 'pump', 'inhalation', 'instillation', 'compression', 'access_drain', 'other_hkp', 'order_revision', 'measurement_link', 'completion_review', 'correction']);
const actualKinds = new Set<TreatmentCareKind>(['injection', 'insulin', 'infusion', 'pump', 'inhalation', 'instillation', 'compression', 'access_drain', 'other_hkp']);
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const instant = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
const instantMicros = (v: string) => { const match = v.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:?\d{2})$/); if (!match)
    return null; const milliseconds = Date.parse(`${match[1]}${match[3]}`); return Number.isFinite(milliseconds) ? BigInt(milliseconds) * 1000n + BigInt((match[2] ?? '').padEnd(6, '0')) : null; };
const date = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) === v;
const text = (v: unknown, min = 0, max = 8000): v is string => typeof v === 'string' && v.trim().length >= min && v.length <= max;
const sha = (v: unknown): v is string => typeof v === 'string' && /^sha256:[0-9a-f]{64}$/.test(v);
const decimal = (v: unknown): v is string => typeof v === 'string' && /^(0|[1-9][0-9]{0,7})(\.[0-9]{1,3})?$/.test(v);
const decimalMilli = (v: string) => { const [whole, fraction = ''] = v.split('.'); return BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, '0')); };
const stable = (v: unknown) => JSON.stringify(v, (_key, item: unknown) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item as Record<string, unknown>).sort().map(k => [k, (item as Record<string, unknown>)[k]])) : item);
const deepFreeze = <T>(value: T): T => { if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>))
        deepFreeze(child);
} return value; };
const source = (list: readonly TreatmentCareRef[], limit = 4000) => Array.isArray(list) && list.length <= limit && list.every(x => x && uuid(x.id) && Number.isSafeInteger(x.revision) && x.revision > 0 && instant(x.recordedAt) && sha(x.fingerprint) && uuid(x.clientId) && (x.orderId === null || uuid(x.orderId)) && x.payload && typeof x.payload === 'object' && !Array.isArray(x.payload)) && new Set(list.map(x => x.id)).size === list.length;
export function blankTreatmentCareEntry(kind: TreatmentCareKind, clientId: string, orderId: string, orderVersion: string, now = new Date().toISOString()): TreatmentCareEntry { return { kind, title: '', plannedAt: now, occurredAt: null, clientId, orderId, orderVersion, order: { status: 'active', validFrom: now.slice(0, 10), validUntil: null, prescriber: '', scope: '', instructions: '', revisionReason: '', previousOrderId: null }, payer: { state: 'unknown', approvalId: null, reference: '', validFrom: null, validUntil: null, decisionNote: '' }, execution: { treatmentType: 'none', outcome: 'planned', action: '', substance: '', amount: null, unit: '', route: '', site: '', device: '', observation: '', deviation: '' }, material: { state: 'not_required', originalId: null, name: '', batch: '', expiresOn: null, quantity: null, unit: '', purpose: '', reason: 'Für diesen Vorgang ist kein gesondertes Materialoriginal erforderlich.' }, qualification: { state: 'unconfirmed', performedBy: null, reviewedBy: null, evidence: '', delegation: '' }, measurement: { state: 'not_required', measurementId: null, kind: '', value: '', unit: '', occurredAt: null, maximumAgeMinutes: null, reason: '' }, infusion: { state: 'not_applicable', courseId: null, headId: null, sequence: null, deviceMode: 'none', rateMlHour: null, deliveredMl: null, remainingMl: null, sourceNote: '' }, followUp: { state: 'pending', scheduledAt: null, completedAt: null, responsibleBy: null, communication: '', personDecision: '', result: '' }, correction: { targetId: null, reason: '', replacementId: null, approvedBy: null, approvedAt: null }, lifecycle: 'open' }; }
export function treatmentCareSourcesIssue(v: unknown): string | null { const s = v as TreatmentCareSources; if (!s || !source(s.orders) || !source(s.approvals) || !source(s.executions) || !source(s.infusions) || !source(s.measurements) || !source(s.invalidations) || !source(s.corrections) || !source(s.people) || !source(s.documents))
    return 'Behandlungsquellen sind abgeschnitten, innerhalb ihrer Art doppelt, fremd oder ohne native Revision.'; return null; }
export function treatmentCareEntryIssue(v: unknown, options: Readonly<{
    allowLegacyMaterial?: boolean;
}> = {}): string | null {
    const e = v as TreatmentCareEntry;
    if (!e || !kinds.has(e.kind) || !text(e.title, 3, 300) || !instant(e.plannedAt) || ![e.clientId, e.orderId].every(uuid) || !instant(e.orderVersion) || !e.order || !e.payer || !e.execution || !e.qualification || !e.measurement || !e.infusion || !e.followUp || !e.correction || !e.material && !options.allowLegacyMaterial)
        return 'Behandlungspaket ist nicht vollständig an Pflegefall und Verordnungsfassung gebunden.';
    const o = e.order;
    if (!['draft', 'active', 'paused', 'stopped', 'expired'].includes(o.status) || !date(o.validFrom) || o.validUntil !== null && !date(o.validUntil) || o.validUntil !== null && o.validUntil < o.validFrom || !text(o.prescriber, 1) || !text(o.scope, 3) || !text(o.instructions, 3))
        return 'Ärztliche Fassung benötigt Status, Gültigkeit, Quelle, Umfang und Anweisung.';
    const p = e.payer;
    if (!['not_required', 'pending', 'approved', 'partially_approved', 'rejected', 'unknown'].includes(p.state) || p.state === 'approved' && (!uuid(p.approvalId) || !text(p.reference, 1) || !date(p.validFrom) || p.validUntil !== null && !date(p.validUntil)) || p.state !== 'approved' && p.approvalId !== null && !uuid(p.approvalId) || !text(p.decisionNote, 3))
        return 'Kostenträgerentscheidung muss getrennt mit Status, Originalbezug und Hinweis dokumentiert sein.';
    const x = e.execution, actual = actualKinds.has(e.kind);
    if (actual) {
        if (x.treatmentType !== e.kind && !(e.kind === 'pump' && x.treatmentType === 'infusion') || !['performed', 'partial', 'omitted', 'refused', 'failed'].includes(x.outcome) || !instant(e.occurredAt) || !text(x.observation, 3) || !text(x.action, 3))
            return 'Tatsächliche Behandlung benötigt Art, Ergebnis, Zeitpunkt, Handlung und Beobachtung.';
        if (['performed', 'partial'].includes(x.outcome) && (['injection', 'insulin', 'infusion', 'inhalation', 'instillation'].includes(x.treatmentType) && (!text(x.substance, 1) || !decimal(x.amount) || !text(x.unit, 1) || !text(x.route, 1)) || ['compression', 'access_drain', 'other_hkp'].includes(x.treatmentType) && !text(x.site, 1)))
            return 'Durchgeführte Maßnahme benötigt konkrete Substanz/Menge/Weg oder Lokalisation.';
        if (!['performed', 'partial'].includes(x.outcome) && (x.amount !== null || x.substance || x.unit || x.route || !text(x.deviation, 3)))
            return 'Nichtdurchführung darf keine tatsächliche Gabe vortäuschen und benötigt einen Grund.';
    }
    else if (x.treatmentType !== 'none' || x.outcome !== 'planned' || e.occurredAt !== null)
        return 'Prüf-, Freigabe- und Korrekturwege dürfen keine tatsächliche Durchführung ableiten.';
    const material = e.material;
    if (material) {
        if (!['not_required', 'selected', 'used', 'unavailable'].includes(material.state) || material.expiresOn !== null && !date(material.expiresOn) || material.quantity !== null && !decimal(material.quantity) || !text(material.reason, 3))
            return 'Materialstatus, Menge, Einheit, Verwendungszweck und Begründung sind unvollständig.';
        if (material.state === 'used' && (!uuid(material.originalId) || !text(material.name, 1, 300) || !decimal(material.quantity) || !text(material.unit, 1, 100) || !text(material.purpose, 3, 1000)))
            return 'Tatsächlicher Materialverbrauch benötigt ein ausdrücklich gewähltes Original, Menge, Einheit und Zweck.';
        if (material.state === 'selected' && (!uuid(material.originalId) || !text(material.name, 1, 300)))
            return 'Ausgewähltes Material benötigt ein ausdrücklich bezeichnetes Original.';
        if (['not_required', 'unavailable'].includes(material.state) && (material.originalId !== null || material.quantity !== null || material.name || material.batch || material.unit || material.purpose))
            return 'Nicht erforderliches oder nicht verfügbares Material darf keinen Verbrauch vortäuschen.';
        if (actual && ['performed', 'partial'].includes(x.outcome) && !['used', 'not_required'].includes(material.state))
            return 'Durchgeführte Behandlung benötigt tatsächlichen Materialverbrauch oder eine ausdrückliche Nicht-Erforderlichkeit.';
        if ((!actual || !['performed', 'partial'].includes(x.outcome)) && material.state === 'used')
            return 'Planung oder Nichtdurchführung darf keinen tatsächlichen Materialverbrauch ableiten.';
    }
    const q = e.qualification;
    if (!['unconfirmed', 'documented', 'independently_confirmed'].includes(q.state) || q.state !== 'unconfirmed' && (!uuid(q.performedBy) || !text(q.evidence, 3) || !text(q.delegation, 3)) || q.state === 'independently_confirmed' && (!uuid(q.reviewedBy) || q.reviewedBy === q.performedBy) || q.state === 'unconfirmed' && e.lifecycle === 'completed')
        return 'Qualifikation und Delegation müssen aktuell belegt oder der Abschluss gesperrt bleiben.';
    const m = e.measurement;
    if (m.state === 'linked') {
        if (!uuid(m.measurementId) || !text(m.kind, 1) || !text(m.value, 1) || !text(m.unit, 1) || !instant(m.occurredAt) || !decimal(m.maximumAgeMinutes) || !text(m.reason, 3))
            return 'Messwertbezug benötigt Original, Art, Wert, Einheit, Zeitpunkt und begründete Altersgrenze.';
    }
    else if (m.measurementId !== null || m.occurredAt !== null || m.maximumAgeMinutes !== null || !text(m.reason, 3) || e.kind === 'insulin' && m.state !== 'unconfirmed')
        return 'Fehlender oder nicht erforderlicher Messwertbezug muss ausdrücklich begründet sein.';
    const i = e.infusion;
    if (['infusion', 'pump'].includes(e.kind)) {
        if (i.state !== 'linked' || !uuid(i.courseId) || !uuid(i.headId) || !Number.isSafeInteger(i.sequence) || i.sequence! < 1 || !['gravity', 'pump'].includes(i.deviceMode) || e.kind === 'pump' && i.deviceMode !== 'pump' || i.deviceMode === 'pump' && !decimal(i.rateMlHour) || !text(i.sourceNote, 3))
            return 'Infusions-/Pumpenereignis benötigt vollständigen Verlaufskopf, Sequenz, Betriebsart und Quellhinweis.';
    }
    else if (i.state === 'linked' && (!uuid(i.courseId) || !uuid(i.headId) || !Number.isSafeInteger(i.sequence)))
        return 'Optionaler Infusionsbezug ist unvollständig.';
    if (e.kind === 'order_revision' && (!uuid(o.previousOrderId) || !text(o.revisionReason, 10) || o.previousOrderId === e.orderId))
        return 'Verordnungsänderung braucht das historische Original und eine neue Verordnungsidentität.';
    if (e.kind === 'correction' && (!uuid(e.correction.targetId) || !text(e.correction.reason, 10) || !uuid(e.correction.replacementId) || e.correction.replacementId === e.correction.targetId || !uuid(e.correction.approvedBy) || !instant(e.correction.approvedAt)))
        return 'Korrektur benötigt Original, begründeten Nachtrag, neue Identität und Freigabe.';
    const f = e.followUp;
    if (!['not_required', 'pending', 'scheduled', 'completed'].includes(f.state) || !text(f.communication, 3) || !text(f.personDecision, 3) || f.state === 'scheduled' && (!instant(f.scheduledAt) || !uuid(f.responsibleBy)) || f.state === 'completed' && (!instant(f.completedAt) || !uuid(f.responsibleBy) || !text(f.result, 3)) || ['pending', 'not_required'].includes(f.state) && (f.scheduledAt !== null || f.completedAt !== null))
        return 'Rücksprache, Personenentscheidung und tatsächlicher Folge-/Abschlussstand sind widersprüchlich.';
    if (e.lifecycle === 'completed' && (q.state === 'unconfirmed' || p.state === 'unknown' || m.state === 'unconfirmed' || i.state === 'unconfirmed' || ['pending', 'scheduled'].includes(f.state)))
        return 'Abschluss bleibt bei ungeklärter Verordnung, Qualifikation, Messung, Infusion oder Folgehandlung gesperrt.';
    return ['open', 'completed'].includes(e.lifecycle) ? null : 'Lebenszyklusstatus ist ungültig.';
}
export function treatmentCareOriginalIssue(v: unknown, c: {
    tenantId: string;
    clientId: string;
    orderId: string;
}): string | null { const o = v as TreatmentCareOriginal; if (!o || ![o.id, o.rootId, o.headId, o.recordedBy].every(uuid) || o.tenantId !== c.tenantId || o.clientId !== c.clientId || o.orderId !== c.orderId || !Number.isSafeInteger(o.revision) || o.revision < 1 || !instant(o.recordedAt) || !sha(o.contentFingerprint) || !Array.isArray(o.history) || o.history.length !== o.revision || o.history.length > 2000)
    return 'Behandlungshistorie fehlt, ist abgeschnitten oder fremd.'; for (let n = 0; n < o.history.length; n++) {
    const h = o.history[n], previous = n === 0 ? null : o.history[n - 1].id;
    if (!uuid(h.id) || h.revision !== n + 1 || h.previousId !== previous || !instant(h.recordedAt) || !uuid(h.recordedBy) || !text(h.recordedByName, 1) || !sha(h.contentFingerprint) || treatmentCareEntryIssue(h.payload, { allowLegacyMaterial: true }))
        return 'Behandlungshistorie hat eine Lücke oder einen ungültigen Inhalt.';
} const head = o.history.at(-1)!; return o.id !== head.id || o.headId !== head.id || o.revision !== head.revision || o.recordedAt !== head.recordedAt || o.recordedBy !== head.recordedBy || o.recordedByName !== head.recordedByName || o.contentFingerprint !== head.contentFingerprint || stable(o.payload) !== stable(head.payload) ? 'Behandlungsoriginalkopf widerspricht der Historie.' : null; }
export function treatmentCarePacketIssue(v: unknown): string | null {
    const p = v as TreatmentCarePacket;
    if (!p || p.schemaVersion !== '1' || !['create', 'revise'].includes(p.action) || ![p.requestId, p.tenantId, p.clientId, p.orderId, p.actorId].every(uuid) || p.entry.clientId !== p.clientId || p.entry.orderId !== p.orderId)
        return 'Paketidentität oder Aktenbindung ist ungültig.';
    const sourceIssue = treatmentCareSourcesIssue(p.sources), entryIssue = treatmentCareEntryIssue(p.entry);
    if (sourceIssue || entryIssue)
        return sourceIssue ?? entryIssue;
    const order = p.sources.orders.find(x => x.id === p.orderId);
    if (!order || order.clientId !== p.clientId || order.recordedAt !== p.entry.orderVersion)
        return 'Aktuelle vollständige Verordnungsfassung fehlt oder wurde verändert.';
    const selected = p.sources.approvals.find(x => x.id === p.entry.payer.approvalId);
    if (p.entry.payer.approvalId && (!selected || selected.orderId !== p.orderId || String(selected.payload.reference ?? '') !== p.entry.payer.reference || String(selected.payload.valid_from ?? '') !== (p.entry.payer.validFrom ?? '') || String(selected.payload.valid_until ?? '') !== (p.entry.payer.validUntil ?? '')))
        return 'Kostenträgerentscheidung gehört nicht unverändert zur gewählten Verordnung.';
    if (p.entry.measurement.state === 'linked') {
        const m = p.sources.measurements.find(x => x.id === p.entry.measurement.measurementId), measurementAt = m ? instantMicros(m.recordedAt) : null, eventAt = instantMicros(p.entry.occurredAt ?? p.entry.plannedAt), maximum = decimalMilli(p.entry.measurement.maximumAgeMinutes ?? '0') * 60000n;
        if (!m || m.clientId !== p.clientId || m.recordedAt !== p.entry.measurement.occurredAt || String(m.payload.vital_key ?? '') !== p.entry.measurement.kind || String(m.payload.display_value ?? m.payload.value ?? '') !== p.entry.measurement.value || String(m.payload.unit ?? '') !== p.entry.measurement.unit || p.sources.invalidations.some(x => x.payload.measurement_id === m.id) || measurementAt === null || eventAt === null || measurementAt > eventAt || eventAt - measurementAt > maximum)
            return 'Messwert ist fremd, verändert, ungültig, nachgelagert oder außerhalb der begründeten Altersgrenze.';
    }
    if (p.entry.infusion.state === 'linked') {
        const i = p.sources.infusions.find(x => x.id === p.entry.infusion.headId);
        if (!i || i.clientId !== p.clientId || i.orderId !== p.orderId || i.payload.course_id !== p.entry.infusion.courseId || i.payload.sequence !== p.entry.infusion.sequence)
            return 'Infusionsverlaufskopf oder Sequenz wurde verändert.';
    }
    if (p.entry.material.originalId) {
        const m = p.sources.executions.find(x => x.id === p.entry.material.originalId);
        if (!m || m.clientId !== p.clientId || m.orderId !== p.orderId || String(m.payload.material_name ?? m.payload.material ?? '') !== p.entry.material.name || String(m.payload.material_batch ?? m.payload.batch ?? '') !== p.entry.material.batch || String(m.payload.material_expiry ?? m.payload.expires_on ?? '') !== (p.entry.material.expiresOn ?? '') || String(m.payload.material_quantity ?? m.payload.quantity ?? '') !== (p.entry.material.quantity ?? '') || String(m.payload.material_unit ?? m.payload.unit ?? '') !== p.entry.material.unit)
            return 'Materialoriginal ist fremd, verändert oder gehört nicht zur gewählten Verordnung.';
    }
    if (p.entry.qualification.performedBy && !p.sources.people.some(x => x.id === p.entry.qualification.performedBy && x.payload.active === true && String(x.payload.qualification_state ?? '') === p.entry.qualification.evidence))
        return 'Ausführende Person oder Qualifikationsfassung ist nicht im vollständig gelesenen aktuellen Personenbestand.';
    if (p.entry.qualification.state === 'independently_confirmed' && p.entry.qualification.reviewedBy !== p.actorId)
        return 'Unabhängige Prüfung muss an die eigene aktuelle Sitzung gebunden sein.';
    if (p.entry.kind === 'order_revision' && !p.sources.orders.some(x => x.id === p.entry.order.previousOrderId && x.clientId === p.clientId))
        return 'Historische Vorgängerverordnung fehlt im vollständigen Quellbestand.';
    if (p.entry.kind === 'correction' && (!p.sources.executions.some(x => x.id === p.entry.correction.targetId && x.clientId === p.clientId) || p.entry.correction.approvedBy !== p.actorId || p.entry.correction.replacementId !== p.requestId))
        return 'Korrektur ist nicht an Original, eigene aktuelle Sitzung und Anfrageidentität gebunden.';
    if (p.action === 'create') {
        if (p.original !== null || p.expectedHeadId !== null || p.expectedRevision !== 0 || p.reason)
            return 'Neuanlage darf keinen historischen Kopf vortäuschen.';
    }
    else {
        const issue = p.original ? treatmentCareOriginalIssue(p.original, p) : 'Historisches Original fehlt.';
        if (issue)
            return issue;
        if (p.expectedHeadId !== p.original!.headId || p.expectedRevision !== p.original!.revision || !text(p.reason, 10) || stable(p.entry) === stable(p.original!.payload))
            return 'Fortschreibung benötigt aktuellen CAS-Kopf, konkreten Grund und echte Änderung.';
    }
    return null;
}
export function makeTreatmentCarePacket(v: TreatmentCarePacket): TreatmentCarePacket { const captured = structuredClone(v), issue = treatmentCarePacketIssue(captured); if (issue)
    throw Error(issue); return deepFreeze(captured); }
