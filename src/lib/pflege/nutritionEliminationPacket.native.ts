// Generated native presentation from src/lib/pflege/nutritionEliminationPacket.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
export type NutritionEliminationKind = 'nutrition_assessment' | 'meal_support' | 'drink_protocol' | 'swallowing_support' | 'enteral_nutrition' | 'fluid_balance' | 'continence_support' | 'stool_protocol' | 'catheter_care' | 'stoma_care' | 'tube_observation' | 'weight_followup';
export type NutritionEliminationOutcome = 'planned' | 'offered' | 'performed' | 'partial' | 'refused' | 'not_performed';
export type SourceRef = Readonly<{
    id: string;
    revision: number;
    recordedAt: string;
    fingerprint: string;
}>;
export type NutritionEliminationSources = Readonly<{
    assessment: Readonly<SourceRef & {
        modelVersion: string;
        instrumentVersion: string | null;
    }>;
    protocols: readonly Readonly<SourceRef & {
        kind: string;
    }>[];
    weights: readonly Readonly<SourceRef & {
        measuredAt: string;
        value: string | null;
        unit: string;
        conditions: string;
    }>[];
    devices: readonly Readonly<SourceRef & {
        type: 'catheter' | 'stoma' | 'peg' | 'tube';
        status: string;
    }>[];
    tasks: readonly Readonly<SourceRef & {
        state: string;
        dueAt: string | null;
    }>[];
}>;
export type NutritionEliminationEntry = Readonly<{
    kind: NutritionEliminationKind;
    title: string;
    plannedAt: string;
    occurredAt: string | null;
    planVersionId: string;
    measureId: string;
    visitId: string;
    assessmentId: string;
    planSnapshotSha256: string;
    decision: Readonly<{
        state: 'not_asked' | 'consented' | 'refused' | 'withdrawn';
        recordedAt: string | null;
        reason: string;
        consultation: string;
    }>;
    assistance: Readonly<{
        level: 'independent' | 'prompting' | 'partial_assist' | 'full_assist';
        helpers: readonly string[];
        aids: readonly string[];
        details: string;
    }>;
    intake: Readonly<{
        offered: string | null;
        actual: string | null;
        unit: 'none' | 'g' | 'ml' | 'percent';
        item: string;
        dietForm: string;
        target: string | null;
        targetUnit: 'none' | 'g' | 'ml';
    }>;
    elimination: Readonly<{
        input: string | null;
        output: string | null;
        unit: 'none' | 'ml';
        complete: boolean;
        profileId: string | null;
        support: string;
        stool: string;
        observation: string;
    }>;
    swallowing: Readonly<{
        approvedDiet: string;
        instruction: string;
        deviation: string;
        escalation: string;
    }>;
    enteral: Readonly<{
        deviceId: string | null;
        prescriptionId: string | null;
        product: string;
        amount: string | null;
        unit: 'none' | 'ml' | 'g';
        durationMinutes: string | null;
        flushMl: string | null;
        positionCheck: string;
        skin: string;
        tolerance: string;
    }>;
    device: Readonly<{
        deviceId: string | null;
        changeBasisId: string | null;
        type: 'none' | 'catheter' | 'stoma' | 'peg' | 'tube';
        materialChange: string;
        skin: string;
        positionCheck: string;
        output: string;
        complication: string;
    }>;
    weight: Readonly<{
        value: string | null;
        unit: 'none' | 'kg';
        measurementId: string | null;
        instrumentVersion: string;
        conditions: string;
        professionalAssessment: string;
        reaction: string;
        reviewAt: string | null;
    }>;
    execution: Readonly<{
        outcome: NutritionEliminationOutcome;
        performedBy: readonly string[];
        result: string;
        deviation: string;
    }>;
    followUp: Readonly<{
        required: boolean;
        reason: string;
        responsibleProfileId: string | null;
        dueAt: string | null;
        taskId: string | null;
        state: 'not_required' | 'open' | 'closed';
        closureEvidence: string;
    }>;
    lifecycle: 'open' | 'completed';
}>;
export type NutritionEliminationHistoryItem = Readonly<{
    id: string;
    revision: number;
    previousId: string | null;
    recordedAt: string;
    recordedBy: string;
    recordedByName: string;
    reason: string;
    payload: NutritionEliminationEntry;
    contentFingerprint: string;
}>;
export type NutritionEliminationOriginal = Readonly<{
    id: string;
    tenantId: string;
    clientId: string;
    rootId: string;
    headId: string;
    revision: number;
    kind: NutritionEliminationKind;
    recordedAt: string;
    recordedBy: string;
    recordedByName: string;
    payload: NutritionEliminationEntry;
    contentFingerprint: string;
    history: readonly NutritionEliminationHistoryItem[];
    voided: boolean;
}>;
export type NutritionEliminationPacket = Readonly<{
    schemaVersion: '1';
    action: 'create' | 'revise';
    requestId: string;
    tenantId: string;
    clientId: string;
    actorId: string;
    expectedHeadId: string | null;
    expectedRevision: number;
    entry: NutritionEliminationEntry;
    reason: string;
    original: NutritionEliminationOriginal | null;
    sources: NutritionEliminationSources;
}>;
const kinds = new Set<NutritionEliminationKind>(['nutrition_assessment', 'meal_support', 'drink_protocol', 'swallowing_support', 'enteral_nutrition', 'fluid_balance', 'continence_support', 'stool_protocol', 'catheter_care', 'stoma_care', 'tube_observation', 'weight_followup']);
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const instant = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
const text = (v: unknown, min = 0, max = 8000): v is string => typeof v === 'string' && v.trim().length >= min && v.length <= max;
const sha = (v: unknown): v is string => typeof v === 'string' && /^sha256:[0-9a-f]{64}$/.test(v);
const decimal = (v: unknown): v is string => typeof v === 'string' && /^(0|[1-9][0-9]{0,5})(\.[0-9]{1,3})?$/.test(v);
const optionalDecimal = (v: unknown): v is string | null => v === null || decimal(v);
const uniqueUuids = (v: unknown): v is readonly string[] => Array.isArray(v) && v.every(uuid) && new Set(v).size === v.length;
const clone = <T>(v: T): T => structuredClone(v);
export function blankNutritionEliminationEntry(kind: NutritionEliminationKind, now = new Date().toISOString()): NutritionEliminationEntry { return { kind, title: '', plannedAt: now, occurredAt: null, planVersionId: '', measureId: '', visitId: '', assessmentId: '', planSnapshotSha256: '', decision: { state: 'not_asked', recordedAt: null, reason: '', consultation: '' }, assistance: { level: 'independent', helpers: [], aids: [], details: '' }, intake: { offered: null, actual: null, unit: 'none', item: '', dietForm: '', target: null, targetUnit: 'none' }, elimination: { input: null, output: null, unit: 'none', complete: false, profileId: null, support: '', stool: '', observation: '' }, swallowing: { approvedDiet: '', instruction: '', deviation: '', escalation: '' }, enteral: { deviceId: null, prescriptionId: null, product: '', amount: null, unit: 'none', durationMinutes: null, flushMl: null, positionCheck: '', skin: '', tolerance: '' }, device: { deviceId: null, changeBasisId: null, type: 'none', materialChange: '', skin: '', positionCheck: '', output: '', complication: '' }, weight: { value: null, unit: 'none', measurementId: null, instrumentVersion: '', conditions: '', professionalAssessment: '', reaction: '', reviewAt: null }, execution: { outcome: 'planned', performedBy: [], result: '', deviation: '' }, followUp: { required: false, reason: '', responsibleProfileId: null, dueAt: null, taskId: null, state: 'not_required', closureEvidence: '' }, lifecycle: 'open' }; }
export function nutritionEliminationSourcesIssue(v: unknown): string | null {
    const s = v as NutritionEliminationSources;
    if (!s || !s.assessment || !uuid(s.assessment.id) || !Number.isSafeInteger(s.assessment.revision) || s.assessment.revision < 1 || !instant(s.assessment.recordedAt) || !sha(s.assessment.fingerprint) || !text(s.assessment.modelVersion, 1) || s.assessment.instrumentVersion !== null && !text(s.assessment.instrumentVersion, 1) || !Array.isArray(s.protocols) || !Array.isArray(s.weights) || !Array.isArray(s.devices) || !Array.isArray(s.tasks))
        return 'Vollständige Assessment- und Quelloriginale fehlen.';
    const all = [...s.protocols, ...s.weights, ...s.devices, ...s.tasks];
    if (all.length > 2000 || all.some(x => !x || !uuid(x.id) || !Number.isSafeInteger(x.revision) || x.revision < 1 || !instant(x.recordedAt) || !sha(x.fingerprint)) || new Set(all.map(x => x.id)).size !== all.length)
        return 'Quelloriginale sind abgeschnitten, doppelt oder ungültig.';
    if (s.protocols.some(x => !text(x.kind, 1)) || s.weights.some(x => !instant(x.measuredAt) || x.value !== null && !decimal(x.value) || !text(x.unit, 1) || !text(x.conditions, 1)) || s.devices.some(x => !['catheter', 'stoma', 'peg', 'tube'].includes(x.type) || !text(x.status, 1)) || s.tasks.some(x => x.dueAt !== null && !instant(x.dueAt) || !text(x.state, 1)))
        return 'Protokoll-, Gewichts-, Geräte- oder Auftragsoriginale sind unvollständig.';
    return null;
}
export function nutritionEliminationEntryIssue(v: unknown): string | null {
    const e = v as NutritionEliminationEntry;
    if (!e || !kinds.has(e.kind) || !text(e.title, 3, 300) || !instant(e.plannedAt) || ![e.planVersionId, e.measureId, e.visitId, e.assessmentId].every(uuid) || !sha(e.planSnapshotSha256))
        return 'Planfassung, Assessment, Maßnahme, Einsatz, Zeitpunkt und Plansnapshot fehlen.';
    if (!e.decision || !e.assistance || !e.intake || !e.elimination || !e.swallowing || !e.enteral || !e.device || !e.weight || !e.execution || !e.followUp)
        return 'Ernährungs- und Ausscheidungspaket ist unvollständig.';
    const actual = e.execution.outcome !== 'planned';
    if (!['planned', 'offered', 'performed', 'partial', 'refused', 'not_performed'].includes(e.execution.outcome) || (actual ? !instant(e.occurredAt) : e.occurredAt !== null))
        return 'Planzeit und tatsächliches Ereignis müssen getrennt bleiben.';
    if (!['not_asked', 'consented', 'refused', 'withdrawn'].includes(e.decision.state) || (e.decision.state === 'not_asked' ? e.decision.recordedAt !== null : !instant(e.decision.recordedAt)))
        return 'Personenentscheidung und Erfassungszeit sind ungültig.';
    if (['performed', 'partial'].includes(e.execution.outcome)) {
        if (e.decision.state !== 'consented' || !uniqueUuids(e.execution.performedBy) || !e.execution.performedBy.length || !text(e.execution.result, 1))
            return 'Tatsächliche Durchführung benötigt Zustimmung, ausführende Person und Ergebnis.';
    }
    else if (e.execution.performedBy.length || text(e.execution.result, 1))
        return 'Planung, Angebot oder Ablehnung dürfen keine Durchführung enthalten.';
    if (e.execution.outcome === 'refused' && (e.decision.state !== 'refused' || !text(e.decision.reason, 1) || !text(e.decision.consultation, 3) || !e.followUp.required))
        return 'Ablehnung benötigt Grund, Beratung und weiteres Vorgehen.';
    if (['partial', 'not_performed'].includes(e.execution.outcome) && !text(e.execution.deviation, 3))
        return 'Teil- oder Nichtdurchführung benötigt eine Abweichung.';
    if (!['independent', 'prompting', 'partial_assist', 'full_assist'].includes(e.assistance.level) || !uniqueUuids(e.assistance.helpers) || !Array.isArray(e.assistance.aids) || e.assistance.aids.some(x => !text(x, 1, 500)) || e.assistance.level !== 'independent' && !text(e.assistance.details, 3))
        return 'Hilfeumfang und Hilfsmittel sind nicht vollständig.';
    if (!optionalDecimal(e.intake.offered) || !optionalDecimal(e.intake.actual) || !optionalDecimal(e.intake.target) || !optionalDecimal(e.elimination.input) || !optionalDecimal(e.elimination.output) || !optionalDecimal(e.enteral.amount) || !optionalDecimal(e.enteral.durationMinutes) || !optionalDecimal(e.enteral.flushMl) || !optionalDecimal(e.weight.value))
        return 'Mengen müssen als unveränderte Dezimalwerte oder ausdrücklich fehlend vorliegen.';
    if (['meal_support', 'drink_protocol'].includes(e.kind)) {
        if (!text(e.intake.item, 1) || (e.intake.offered !== null || e.intake.actual !== null) && e.intake.unit === 'none' || e.intake.actual === null && ['performed', 'partial'].includes(e.execution.outcome) || e.intake.target === null && e.intake.targetUnit !== 'none' || e.intake.target !== null && e.intake.targetUnit === 'none')
            return 'Angebot, tatsächliche Aufnahme und individuelles Ziel müssen getrennt und mit ihrer Originaleinheit dokumentiert sein.';
    }
    if (e.kind === 'nutrition_assessment' && (!text(e.weight.instrumentVersion, 1) || !text(e.weight.professionalAssessment, 3) || e.weight.value === null && e.weight.measurementId !== null || e.weight.value !== null && (!uuid(e.weight.measurementId) || e.weight.unit !== 'kg' || !text(e.weight.conditions, 1))))
        return 'Ernährungsassessment muss fehlenden Messwert von einer belegten Messung unterscheiden.';
    if (e.kind === 'swallowing_support' && (!text(e.swallowing.approvedDiet, 1) || !text(e.swallowing.instruction, 3) || text(e.swallowing.deviation, 1) && (!text(e.swallowing.escalation, 3) || !e.followUp.required)))
        return 'Schluckunterstützung benötigt Kostform, Anweisung und bei Abweichung eine sichtbare Eskalation.';
    if (e.kind === 'enteral_nutrition' && (!uuid(e.enteral.deviceId) || !uuid(e.enteral.prescriptionId) || !text(e.enteral.product, 1) || e.enteral.amount === null || e.enteral.unit === 'none' || e.enteral.durationMinutes === null || e.enteral.flushMl === null || !text(e.enteral.positionCheck, 3) || !text(e.enteral.skin, 1) || !text(e.enteral.tolerance, 1)))
        return 'Enterale Ernährung benötigt ärztliche Grundlage, Zugang, Menge, Laufzeit, Spülung, Lage-, Haut- und Verträglichkeitsbeleg.';
    if (e.kind === 'fluid_balance' && (e.elimination.unit !== 'ml' || e.elimination.input === null && e.elimination.output === null || e.elimination.complete || !text(e.elimination.observation, 3)))
        return 'Dokumentierte Mengen bleiben ein unvollständiger Ausschnitt und keine klinisch freigegebene Bilanz.';
    if (e.kind === 'continence_support' && (!uuid(e.elimination.profileId) || !text(e.elimination.support, 3) || !text(e.elimination.observation, 3)))
        return 'Kontinenzunterstützung benötigt Profil, dokumentierten Bedarf und individuelle Maßnahme.';
    if (e.kind === 'stool_protocol' && (!text(e.elimination.stool, 1) || !text(e.elimination.observation, 1)))
        return 'Stuhlvorgang und Beobachtung müssen als einzelnes Ereignis dokumentiert sein.';
    const deviceKind: {
        [K in NutritionEliminationKind]?: NutritionEliminationEntry['device']['type'];
    } = { catheter_care: 'catheter', stoma_care: 'stoma', tube_observation: 'tube' };
    const requiredDevice = deviceKind[e.kind];
    if (requiredDevice && (e.device.type !== requiredDevice || !uuid(e.device.deviceId) || !uuid(e.device.changeBasisId) || !text(e.device.skin, 1)))
        return 'Geräteversorgung benötigt passende Identität, Wechselgrundlage und getrennte Beobachtung.';
    if (e.kind === 'catheter_care' && (!text(e.device.output, 1) || text(e.device.complication, 1) && !e.followUp.required))
        return 'Katheterversorgung benötigt Ausfuhr und bei Problemen einen Folgeauftrag.';
    if (e.kind === 'stoma_care' && (!text(e.device.materialChange, 1) || !text(e.device.output, 1)))
        return 'Stomaversorgung muss Materialwechsel, Haut und Ausscheidung trennen.';
    if (e.kind === 'tube_observation' && (!text(e.device.positionCheck, 3) || !text(e.enteral.skin, 1) || !text(e.enteral.tolerance, 1)))
        return 'Sondenbeobachtung benötigt getrennte Lage-, Haut- und Verträglichkeitsbelege.';
    if (e.kind === 'weight_followup' && (!uuid(e.weight.measurementId) || e.weight.value === null || e.weight.unit !== 'kg' || !text(e.weight.instrumentVersion, 1) || !text(e.weight.conditions, 1) || !text(e.weight.professionalAssessment, 3) || !text(e.weight.reaction, 3) || !instant(e.weight.reviewAt)))
        return 'Gewichtsverlauf benötigt Originalmessung, Instrumentenfassung, fachliche Bewertung, Reaktion und Rückkontrolle.';
    if (e.followUp.required) {
        if (e.followUp.state === 'not_required' || !text(e.followUp.reason, 3) || !uuid(e.followUp.responsibleProfileId) || !instant(e.followUp.dueAt) || e.followUp.state === 'closed' && (!uuid(e.followUp.taskId) || !text(e.followUp.closureEvidence, 3)))
            return 'Folgeauftrag benötigt Anlass, Verantwortung, Frist und bei Abschluss einen Beleg.';
    }
    else if (e.followUp.state !== 'not_required' || e.followUp.reason || e.followUp.responsibleProfileId || e.followUp.dueAt || e.followUp.taskId || e.followUp.closureEvidence)
        return 'Ohne Folgeauftrag dürfen keine Folgebelege entstehen.';
    if (e.lifecycle === 'completed' && (['planned', 'offered'].includes(e.execution.outcome) || e.followUp.required && e.followUp.state !== 'closed'))
        return 'Abschluss ist erst nach Ergebnis und abgeschlossenen Folgeaufträgen möglich.';
    return ['open', 'completed'].includes(e.lifecycle) ? null : 'Lebenszyklusstatus ist ungültig.';
}
export function nutritionEliminationOriginalIssue(v: unknown, c: {
    tenantId: string;
    clientId: string;
}): string | null { const o = v as NutritionEliminationOriginal; if (!o || ![o.id, o.rootId, o.headId, o.recordedBy].every(uuid) || o.tenantId !== c.tenantId || o.clientId !== c.clientId || !Number.isSafeInteger(o.revision) || o.revision < 1 || !kinds.has(o.kind) || !instant(o.recordedAt) || !text(o.recordedByName, 1) || !sha(o.contentFingerprint) || !Array.isArray(o.history) || o.history.length !== o.revision || typeof o.voided !== 'boolean' || nutritionEliminationEntryIssue(o.payload))
    return 'Vollständiges Ernährungs-/Ausscheidungsoriginal fehlt.'; const ids = new Set<string>(); for (let i = 0; i < o.history.length; i++) {
    const h = o.history[i];
    if (!h || !uuid(h.id) || ids.has(h.id) || h.revision !== i + 1 || (i ? h.previousId !== o.history[i - 1].id : h.previousId !== null) || !instant(h.recordedAt) || !uuid(h.recordedBy) || !text(h.recordedByName, 1) || !text(h.reason, i ? 10 : 0) || !sha(h.contentFingerprint) || nutritionEliminationEntryIssue(h.payload) || h.payload.kind !== o.kind)
        return 'Originalhistorie ist abgeschnitten oder widersprüchlich.';
    ids.add(h.id);
} const head = o.history.at(-1); return o.kind !== o.payload.kind || o.history[0].id !== o.rootId || head?.id !== o.headId || o.id !== o.headId || head?.revision !== o.revision || head?.recordedAt !== o.recordedAt || head?.recordedBy !== o.recordedBy || head?.recordedByName !== o.recordedByName || head?.contentFingerprint !== o.contentFingerprint || JSON.stringify(head?.payload) !== JSON.stringify(o.payload) ? 'Originalkopf stimmt nicht mit der Historie überein.' : null; }
export function nutritionEliminationPacketIssue(v: unknown): string | null {
    const p = v as NutritionEliminationPacket;
    if (!p || p.schemaVersion !== '1' || !['create', 'revise'].includes(p.action) || ![p.requestId, p.tenantId, p.clientId, p.actorId].every(uuid) || !Number.isSafeInteger(p.expectedRevision) || p.expectedRevision < 0 || nutritionEliminationEntryIssue(p.entry) || nutritionEliminationSourcesIssue(p.sources) || p.sources.assessment.id !== p.entry.assessmentId)
        return 'Anfrage ist nicht vollständig an Plan, Assessment und Quelloriginale gebunden.';
    if (p.entry.weight.measurementId) {
        const source = p.sources.weights.find(x => x.id === p.entry.weight.measurementId);
        if (!source || source.value !== p.entry.weight.value || source.unit !== p.entry.weight.unit || source.conditions !== p.entry.weight.conditions)
            return 'Gewicht und Messbedingungen stimmen nicht mit dem gebundenen Original überein.';
    }
    const deviceKind: {
        [K in NutritionEliminationKind]?: NutritionEliminationSources['devices'][number]['type'];
    } = { catheter_care: 'catheter', stoma_care: 'stoma', tube_observation: 'tube' };
    const expectedDevice = deviceKind[p.entry.kind];
    if (expectedDevice && !p.sources.devices.some(x => x.id === p.entry.device.deviceId && x.type === expectedDevice))
        return 'Geräteidentität und Geräteoriginal stimmen nicht überein.';
    if (p.entry.kind === 'enteral_nutrition' && !p.sources.devices.some(x => x.id === p.entry.enteral.deviceId && ['peg', 'tube'].includes(x.type)))
        return 'Enteraler Zugang ist nicht an ein gebundenes Geräteoriginal gekoppelt.';
    if (p.entry.followUp.taskId && !p.sources.tasks.some(x => x.id === p.entry.followUp.taskId))
        return 'Folgeauftrag ist nicht an ein gebundenes Auftragsoriginal gekoppelt.';
    const foundation = p.entry.kind === 'enteral_nutrition' ? { id: p.entry.enteral.prescriptionId, kind: 'prescription' } : expectedDevice ? { id: p.entry.device.changeBasisId, kind: 'device_change_basis' } : p.entry.kind === 'continence_support' ? { id: p.entry.elimination.profileId, kind: 'continence_profile' } : null;
    if (foundation && !p.sources.protocols.some(x => x.id === foundation.id && x.kind === foundation.kind))
        return 'Verordnung, Wechselgrundlage oder Kontinenzprofil benötigt das passende gebundene Quelloriginal.';
    if (p.original && (['planVersionId', 'measureId', 'visitId', 'assessmentId', 'planSnapshotSha256'] as const).some(k => p.entry[k] !== p.original!.payload[k]))
        return 'Fortschreibung darf die ursprüngliche Plan-, Assessment- und Einsatzbindung nicht wechseln.';
    if (p.original?.voided)
        return 'Ein aufgehobenes Original darf nicht fortgeschrieben werden.';
    if (!['none', 'g', 'ml', 'percent'].includes(p.entry.intake.unit) || !['none', 'g', 'ml'].includes(p.entry.intake.targetUnit) || !['none', 'ml', 'g'].includes(p.entry.enteral.unit) || !['none', 'ml'].includes(p.entry.elimination.unit) || typeof p.entry.followUp.required !== 'boolean' || typeof p.entry.elimination.complete !== 'boolean' || !['not_required', 'open', 'closed'].includes(p.entry.followUp.state))
        return 'Originaleinheiten und Folgezustände sind ungültig.';
    if (!['performed', 'partial'].includes(p.entry.execution.outcome) && (p.entry.intake.actual !== null || p.entry.elimination.input !== null || p.entry.elimination.output !== null))
        return 'Planung, Angebot oder Nichtdurchführung dürfen keine tatsächliche Aufnahme oder Ausfuhr enthalten.';
    if (p.entry.intake.unit === 'percent' && p.entry.intake.actual !== null && Number(p.entry.intake.actual) > 100)
        return 'Ein Portionsanteil darf 100 Prozent nicht überschreiten.';
    if (p.entry.followUp.state === 'closed' && !p.sources.tasks.some(x => x.id === p.entry.followUp.taskId && x.state === 'completed' && x.dueAt === p.entry.followUp.dueAt))
        return 'Abschluss benötigt das tatsächlich erledigte Auftragsoriginal mit derselben Frist.';
    if (['performed', 'partial'].includes(p.entry.execution.outcome)) {
        const selected = p.entry.kind === 'enteral_nutrition' ? p.entry.enteral.deviceId : expectedDevice ? p.entry.device.deviceId : null;
        if (selected && !p.sources.devices.some(x => x.id === selected && x.status === 'active'))
            return 'Tatsächliche Versorgung benötigt das aktuelle aktive Geräteoriginal.';
    }
    if (p.action === 'create')
        return p.expectedHeadId !== null || p.expectedRevision !== 0 || p.original !== null || p.reason ? 'Neuanlage darf kein erfundenes Original enthalten.' : null;
    if (!p.original || nutritionEliminationOriginalIssue(p.original, { tenantId: p.tenantId, clientId: p.clientId }) || p.expectedHeadId !== p.original.headId || p.expectedRevision !== p.original.revision || p.entry.kind !== p.original.kind || !text(p.reason, 10, 2000) || JSON.stringify(p.entry) === JSON.stringify(p.original.payload))
        return 'Fortschreibung benötigt vollständiges Original, CAS, Grund und echte Änderung.';
    return null;
}
export function makeNutritionEliminationPacket(input: Omit<NutritionEliminationPacket, 'schemaVersion'>): NutritionEliminationPacket { const p = clone({ schemaVersion: '1' as const, ...input }); const issue = nutritionEliminationPacketIssue(p); if (issue)
    throw Error(issue); return Object.freeze(p); }
// The review is a separate fact. A saved or completed care entry never implies acceptance.
export type NutritionReviewQualification = Readonly<{
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
    scopeKind: NutritionEliminationKind;
    scopeFingerprint: string;
}>;
export type NutritionReviewEvent = Readonly<{
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
    careHeadId: string;
    careFingerprint: string;
    qualification: NutritionReviewQualification | null;
    fingerprint: string;
}>;
export type NutritionReviewOriginal = Readonly<{
    id: string;
    tenantId: string;
    clientId: string;
    rootId: string;
    headId: string;
    revision: number;
    careRootId: string;
    careHeadId: string;
    careFingerprint: string;
    careKind: NutritionEliminationKind;
    status: 'requested' | 'returned' | 'accepted';
    history: readonly NutritionReviewEvent[];
}>;
export type NutritionReviewPacket = Readonly<{
    schemaVersion: '1';
    action: 'request' | 'return' | 'accept';
    requestId: string;
    tenantId: string;
    clientId: string;
    actorId: string;
    expectedHeadId: string | null;
    expectedRevision: number;
    careOriginal: NutritionEliminationOriginal;
    reviewOriginal: NutritionReviewOriginal | null;
    reason: string;
    requiredChange: string;
    rationale: string;
}>;
export const nutritionStable = (v: unknown): string => JSON.stringify(v, (_key, item: unknown) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, (item as Record<string, unknown>)[key]])) : item);
export function nutritionInstantMicros(v: unknown): bigint | null {
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
const calendarDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && nutritionInstantMicros(`${v}T00:00:00Z`) !== null;
const berlinDay = (at: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at));
function nutritionQualificationIssue(q: NutritionReviewQualification | null, actor: string, kind: NutritionEliminationKind, at: string): string | null {
    if (!q || ![q.id, q.employeeId, q.profileId, q.documentId, q.scopeId].every(uuid) || q.profileId !== actor || q.scopeKind !== kind || !text(q.qualificationType, 1, 200) || !text(q.title, 1, 500) || !['valid', 'expires_soon'].includes(q.status) || ![q.documentFingerprint, q.sourceFingerprint, q.employeeFingerprint, q.scopeFingerprint].every(sha) || !calendarDate(q.employmentStart) || q.employmentEnd !== null && !calendarDate(q.employmentEnd) || q.issuedAt !== null && !calendarDate(q.issuedAt) || q.validUntil !== null && !calendarDate(q.validUntil))
        return 'Vollständige Beschäftigungs-, Qualifikations-, Dokument- und Prüfbereichsoriginale fehlen.';
    const verified = nutritionInstantMicros(q.verifiedAt), updated = nutritionInstantMicros(q.updatedAt), recorded = nutritionInstantMicros(at);
    if (verified === null || updated === null || recorded === null || verified > recorded || updated > recorded)
        return 'Qualifikation war zum Prüfzeitpunkt nicht verifiziert.';
    const day = berlinDay(at);
    return q.employmentStart > day || q.employmentEnd !== null && q.employmentEnd < day || q.issuedAt !== null && q.issuedAt > day || q.validUntil !== null && q.validUntil < day ? 'Beschäftigung oder Qualifikation gilt am Prüftag nicht.' : null;
}
export function nutritionReviewOriginalIssue(v: unknown, c: {
    tenantId: string;
    clientId: string;
}): string | null {
    const o = v as NutritionReviewOriginal;
    if (!o || ![o.id, o.rootId, o.headId, o.careRootId, o.careHeadId].every(uuid) || o.tenantId !== c.tenantId || o.clientId !== c.clientId || !kinds.has(o.careKind) || !sha(o.careFingerprint) || ![1, 2].includes(o.revision) || !Array.isArray(o.history) || o.history.length !== o.revision)
        return 'Vollständiges Ernährungs-/Ausscheidungsprüforiginal fehlt.';
    const ids = new Set<string>(), requests = new Set<string>();
    for (let i = 0; i < o.history.length; i++) {
        const e = o.history[i], prior = i ? o.history[i - 1] : null;
        if (!e || ![e.id, e.requestId, e.actorId, e.careHeadId].every(uuid) || ids.has(e.id) || requests.has(e.requestId) || e.revision !== i + 1 || e.previousId !== (prior?.id ?? null) || e.careHeadId !== o.careHeadId || e.careFingerprint !== o.careFingerprint || nutritionInstantMicros(e.recordedAt) === null || !text(e.actorName, 1, 500) || !sha(e.fingerprint))
            return 'Prüfhistorie ist abgeschnitten, doppelt oder an eine andere Fassung gebunden.';
        if (!i) {
            if (e.action !== 'request' || !text(e.reason, 10, 2000) || e.requiredChange !== '' || e.rationale !== '' || e.qualification !== null)
                return 'Prüfanfrage enthält eine unzulässige Entscheidung.';
        }
        else {
            if (prior!.action !== 'request' || e.actorId === prior!.actorId || nutritionInstantMicros(e.recordedAt)! < nutritionInstantMicros(prior!.recordedAt)!)
                return 'Prüfentscheidung benötigt eine zeitlich nachfolgende getrennte Person.';
            const issue = nutritionQualificationIssue(e.qualification, e.actorId, o.careKind, e.recordedAt);
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
    return first.id !== o.rootId || o.id !== o.headId || last.id !== o.headId || o.status !== (last.action === 'request' ? 'requested' : last.action === 'return' ? 'returned' : last.action === 'accept' ? 'accepted' : null) ? 'Prüfkopf stimmt nicht mit der vollständigen Historie überein.' : null;
}
export function nutritionReviewPacketIssue(v: unknown): string | null {
    const p = v as NutritionReviewPacket;
    if (!p || p.schemaVersion !== '1' || !['request', 'return', 'accept'].includes(p.action) || ![p.requestId, p.tenantId, p.clientId, p.actorId].every(uuid) || !Number.isSafeInteger(p.expectedRevision) || p.expectedRevision < 0)
        return 'Prüfanfrage ist nicht vollständig gebunden.';
    const issue = nutritionEliminationOriginalIssue(p.careOriginal, { tenantId: p.tenantId, clientId: p.clientId });
    if (issue)
        return issue;
    const care = p.careOriginal;
    if (care.voided || ['planned', 'offered'].includes(care.payload.execution.outcome))
        return 'Eine Planung oder ein Angebot belegt kein prüfbares tatsächliches Ergebnis.';
    if (p.action === 'request')
        return p.expectedHeadId !== null || p.expectedRevision !== 0 || p.reviewOriginal !== null || !text(p.reason, 10, 2000) || p.requiredChange !== '' || p.rationale !== '' ? 'Prüfanfrage darf keine Entscheidung vorwegnehmen.' : null;
    const review = p.reviewOriginal;
    if (!review || nutritionReviewOriginalIssue(review, { tenantId: p.tenantId, clientId: p.clientId }) || review.careRootId !== care.rootId || review.careHeadId !== care.headId || review.careFingerprint !== care.contentFingerprint || review.careKind !== care.kind || review.status !== 'requested' || p.expectedHeadId !== review.headId || p.expectedRevision !== review.revision)
        return 'Aktuelle unveränderte Prüfanfrage und Pflegefassung stimmen nicht überein.';
    const involved = new Set(care.history.flatMap(item => [item.recordedBy, ...item.payload.execution.performedBy]));
    if (p.actorId === review.history[0].actorId || involved.has(p.actorId))
        return 'Anfragende, dokumentierende oder ausführende Personen dürfen dieselbe Fassung nicht selbst annehmen oder zurückgeben.';
    if (p.action === 'return')
        return !text(p.reason, 10, 2000) || !text(p.requiredChange, 10, 4000) || p.rationale !== '' ? 'Rückgabe benötigt Grund und konkrete Änderung.' : null;
    return care.payload.lifecycle !== 'completed' || care.payload.followUp.required && care.payload.followUp.state !== 'closed' || p.reason !== '' || p.requiredChange !== '' || !text(p.rationale, 10, 4000) ? 'Annahme benötigt abgeschlossenen Verlauf, erledigte Folgen und eine eigene fachliche Begründung.' : null;
}
export function makeNutritionReviewPacket(input: Omit<NutritionReviewPacket, 'schemaVersion'>): NutritionReviewPacket {
    const p = clone({ schemaVersion: '1' as const, ...input });
    const issue = nutritionReviewPacketIssue(p);
    if (issue)
        throw Error(issue);
    return Object.freeze(p);
}
export type NutritionQuantitySummary = Readonly<{
    start: string;
    end: string;
    entries: number;
    missing: number;
    groups: readonly Readonly<{
        channel: string;
        unit: string;
        value: string;
        count: number;
    }>[];
}>;
export function summarizeNutritionQuantities(originals: readonly NutritionEliminationOriginal[], context: {
    tenantId: string;
    clientId: string;
}, start: string, end: string): NutritionQuantitySummary {
    const lo = nutritionInstantMicros(start), hi = nutritionInstantMicros(end);
    if (lo === null || hi === null || lo >= hi)
        throw Error('Ein gültiger Zeitraum mit eigener Zeitzone fehlt.');
    const roots = new Map<string, NutritionEliminationOriginal>(), totals = new Map<string, {
        channel: string;
        unit: string;
        value: bigint;
        count: number;
    }>();
    let entries = 0, missing = 0;
    const add = (channel: string, unit: string, value: string | null) => { if (value === null) {
        missing++;
        return;
    } if (!decimal(value))
        throw Error('Ungültige Originalmenge.'); const [whole, fraction = ''] = value.split('.'), scaled = BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, '0')), key = `${channel}:${unit}`; const group = totals.get(key) ?? { channel, unit, value: 0n, count: 0 }; group.value += scaled; group.count++; totals.set(key, group); };
    for (const o of originals) {
        const issue = nutritionEliminationOriginalIssue(o, context);
        if (issue)
            throw Error(issue);
        const previous = roots.get(o.rootId);
        if (previous) {
            if (nutritionStable(previous) !== nutritionStable(o))
                throw Error('Mehrere Fassungen derselben Wurzel: Bestand erneut vollständig laden.');
            continue;
        }
        roots.set(o.rootId, o);
    }
    for (const o of roots.values()) {
        const e = o.payload, at = nutritionInstantMicros(e.occurredAt);
        if (e.occurredAt !== null && at === null)
            throw Error('Ungültiger tatsächlicher Ereigniszeitpunkt.');
        if (o.voided || at === null || at < lo || at >= hi || !['performed', 'partial'].includes(e.execution.outcome))
            continue;
        if (['meal_support', 'drink_protocol'].includes(e.kind)) {
            if (!['g', 'ml', 'percent'].includes(e.intake.unit))
                throw Error('Originaleinheit fehlt.');
            entries++;
            add(e.intake.unit === 'percent' ? `${e.kind}:${o.rootId}` : e.kind, e.intake.unit, e.intake.actual);
        }
        if (e.kind === 'fluid_balance') {
            entries++;
            add('documented_input', 'ml', e.elimination.input);
            add('documented_output', 'ml', e.elimination.output);
        }
    }
    return { start, end, entries, missing, groups: [...totals.values()].sort((a, b) => `${a.channel}:${a.unit}`.localeCompare(`${b.channel}:${b.unit}`)).map(g => { const whole = g.value / 1000n, fraction = (g.value % 1000n).toString().padStart(3, '0').replace(/0+$/, ''); return { ...g, value: `${whole}${fraction ? '.' + fraction : ''}` }; }) };
}
