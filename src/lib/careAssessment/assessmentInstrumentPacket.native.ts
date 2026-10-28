// Generated native presentation from src/lib/careAssessment/assessmentInstrumentPacket.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
export type AssessmentInstrumentOwnership = 'caresuite' | 'licensed_external' | 'external_reference';
export type AssessmentInstrumentAvailability = 'active' | 'unavailable' | 'retired';
export type AssessmentInstrumentDefinition = {
    id: string;
    key: string;
    title: string;
    version: string;
    ownership: AssessmentInstrumentOwnership;
    availability: AssessmentInstrumentAvailability;
    licenseState: 'owned' | 'licensed' | 'unverified' | 'expired';
    riskKeys: string[];
    sourceRevision: string;
};
export type AssessmentModelDefinition = {
    key: string;
    title: string;
    version: string;
    claim: 'product_model' | 'external_standard';
    status: 'active' | 'unavailable' | 'retired';
};
export type AssessmentInstrumentSelection = {
    revision: number;
    modelKey: string;
    modelVersion: string;
    selectedInstrumentIds: string[];
    rationale: string;
    updatedAt: string | null;
};
export type AssessmentInstrumentSnapshot = {
    tenantId: string;
    assessmentId: string;
    subjectId: string;
    actorId: string;
    catalogRevision: string;
    readAt: string;
    model: AssessmentModelDefinition;
    instruments: AssessmentInstrumentDefinition[];
    selection: AssessmentInstrumentSelection;
};
export type AssessmentInstrumentPacket = {
    schemaVersion: '1';
    tenantId: string;
    assessmentId: string;
    subjectId: string;
    actorId: string;
    catalogRevision: string;
    readAt: string;
    model: {
        key: string;
        version: string;
        claim: 'product_model' | 'external_standard';
    };
    selectionRevision: number;
    selectionUpdatedAt: string | null;
    selectedInstrumentIds: string[];
    rationale: string;
    selectedOriginals: AssessmentInstrumentDefinition[];
};
const uuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const iso = (v: unknown) => typeof v === 'string' && !Number.isNaN(Date.parse(v));
const text = (v: unknown, max = 500) => typeof v === 'string' && v.length <= max;
const sortedUnique = (values: string[]) => [...new Set(values)].sort();
export function validateAssessmentInstrumentSnapshot(value: unknown, context: {
    tenantId: string;
    assessmentId: string;
    subjectId: string;
    actorId: string;
}): string | null {
    const s = value as AssessmentInstrumentSnapshot;
    if (!s || typeof s !== 'object' || s.tenantId !== context.tenantId || s.assessmentId !== context.assessmentId || s.subjectId !== context.subjectId || s.actorId !== context.actorId)
        return 'Instrumentenbestand gehört nicht zum aktuellen Benutzer-, Mandanten- oder Pflegefallbezug.';
    if (![s.tenantId, s.assessmentId, s.subjectId, s.actorId].every(uuid) || !text(s.catalogRevision, 120) || !s.catalogRevision || !iso(s.readAt))
        return 'Instrumentenbestand ist unvollständig.';
    if (!s.model || !text(s.model.key, 120) || !text(s.model.title, 240) || !text(s.model.version, 80) || !['product_model', 'external_standard'].includes(s.model.claim) || !['active', 'unavailable', 'retired'].includes(s.model.status))
        return 'Assessmentmodell ist unvollständig.';
    if (!Array.isArray(s.instruments) || s.instruments.length > 200 || !s.selection || !Number.isSafeInteger(s.selection.revision) || s.selection.revision < 0 || !text(s.selection.rationale, 4000) || !Array.isArray(s.selection.selectedInstrumentIds) || s.selection.selectedInstrumentIds.length > 200)
        return 'Instrumentenauswahl ist unvollständig.';
    const ids = new Set<string>(), keys = new Set<string>();
    for (const item of s.instruments) {
        if (!item || !uuid(item.id) || ids.has(item.id) || !text(item.key, 120) || !item.key || keys.has(item.key) || !text(item.title, 240) || !item.title || !text(item.version, 80) || !item.version || !['caresuite', 'licensed_external', 'external_reference'].includes(item.ownership) || !['active', 'unavailable', 'retired'].includes(item.availability) || !['owned', 'licensed', 'unverified', 'expired'].includes(item.licenseState) || !Array.isArray(item.riskKeys) || item.riskKeys.length > 80 || item.riskKeys.some(k => !text(k, 120) || !k) || !text(item.sourceRevision, 120) || !item.sourceRevision)
            return 'Instrumentenoriginal ist ungültig.';
        ids.add(item.id);
        keys.add(item.key);
    }
    if (new Set(s.selection.selectedInstrumentIds).size !== s.selection.selectedInstrumentIds.length || s.selection.selectedInstrumentIds.some(id => !ids.has(id)))
        return 'Gespeicherte Instrumentenauswahl verweist auf einen fremden oder fehlenden Datensatz.';
    if (s.selection.modelKey !== s.model.key || s.selection.modelVersion !== s.model.version)
        return 'Gespeicherte Modellauswahl stimmt nicht mit dem gelesenen Modell überein.';
    if (s.selection.updatedAt !== null && !iso(s.selection.updatedAt))
        return 'Gespeicherter Instrumentenzeitpunkt ist ungültig.';
    return null;
}
export function makeAssessmentInstrumentPacket(snapshot: AssessmentInstrumentSnapshot, selectedIds: string[], rationale: string, riskKeys: string[]): AssessmentInstrumentPacket {
    const issue = validateAssessmentInstrumentSnapshot(snapshot, { tenantId: snapshot.tenantId, assessmentId: snapshot.assessmentId, subjectId: snapshot.subjectId, actorId: snapshot.actorId });
    if (issue)
        throw Error(issue);
    const selected = sortedUnique(selectedIds), riskSet = new Set(riskKeys);
    if (selected.length !== selectedIds.length)
        throw Error('Instrumente dürfen nur einmal ausgewählt werden.');
    const originals = selected.map(id => snapshot.instruments.find(item => item.id === id));
    if (originals.some(item => !item))
        throw Error('Instrumentenauswahl verweist auf einen fehlenden Originaldatensatz.');
    for (const item of originals as AssessmentInstrumentDefinition[]) {
        if (item.availability !== 'active' || !['owned', 'licensed'].includes(item.licenseState))
            throw Error('Nicht verfügbare oder ungeklärt lizenzierte Instrumente dürfen nicht ausgewählt werden.');
        if (item.riskKeys.length && !item.riskKeys.some(key => riskSet.has(key)))
            throw Error(`${item.title} benötigt einen passenden dokumentierten Risikobezug.`);
    }
    const packet: AssessmentInstrumentPacket = { schemaVersion: '1', tenantId: snapshot.tenantId, assessmentId: snapshot.assessmentId, subjectId: snapshot.subjectId, actorId: snapshot.actorId, catalogRevision: snapshot.catalogRevision, readAt: snapshot.readAt, model: { key: snapshot.model.key, version: snapshot.model.version, claim: snapshot.model.claim }, selectionRevision: snapshot.selection.revision, selectionUpdatedAt: snapshot.selection.updatedAt, selectedInstrumentIds: selected, rationale: rationale.trim(), selectedOriginals: structuredClone(originals as AssessmentInstrumentDefinition[]) };
    const packetIssue = validateAssessmentInstrumentPacket(packet);
    if (packetIssue)
        throw Error(packetIssue);
    return packet;
}
export function validateAssessmentInstrumentPacket(value: unknown): string | null {
    const p = value as AssessmentInstrumentPacket;
    if (!p || typeof p !== 'object' || p.schemaVersion !== '1' || ![p.tenantId, p.assessmentId, p.subjectId, p.actorId].every(uuid) || !text(p.catalogRevision, 120) || !p.catalogRevision || !iso(p.readAt))
        return 'Instrumentenpaket ist unvollständig.';
    if (!p.model || !text(p.model.key, 120) || !p.model.key || !text(p.model.version, 80) || !p.model.version || !['product_model', 'external_standard'].includes(p.model.claim))
        return 'Assessmentmodell im Instrumentenpaket ist ungültig.';
    if (!Number.isSafeInteger(p.selectionRevision) || p.selectionRevision < 0 || (p.selectionUpdatedAt !== null && !iso(p.selectionUpdatedAt)) || !Array.isArray(p.selectedInstrumentIds) || p.selectedInstrumentIds.length > 200 || new Set(p.selectedInstrumentIds).size !== p.selectedInstrumentIds.length || !text(p.rationale, 4000) || !Array.isArray(p.selectedOriginals) || p.selectedOriginals.length !== p.selectedInstrumentIds.length)
        return 'Instrumentenauswahl im Paket ist ungültig.';
    for (let i = 0; i < p.selectedOriginals.length; i++) {
        const item = p.selectedOriginals[i];
        if (!item || item.id !== p.selectedInstrumentIds[i] || !uuid(item.id) || item.availability !== 'active' || !['owned', 'licensed'].includes(item.licenseState) || !text(item.sourceRevision, 120) || !item.sourceRevision)
            return 'Ausgewähltes Instrument ist nicht als verfügbares Original belegt.';
    }
    return null;
}
export function sameAssessmentInstrumentPacket(a: AssessmentInstrumentPacket | null, b: AssessmentInstrumentPacket | null) { return JSON.stringify(a) === JSON.stringify(b); }
export function assessmentInstrumentPacketIssue(packet: AssessmentInstrumentPacket | null, riskKeys: string[], review = false): string | null {
    if (!packet)
        return 'Instrumenten- und Modellbestand vollständig laden.';
    const issue = validateAssessmentInstrumentPacket(packet);
    if (issue)
        return issue;
    const risks = new Set(riskKeys);
    for (const item of packet.selectedOriginals)
        if (item.riskKeys.length && !item.riskKeys.some(key => risks.has(key)))
            return `${item.title} hat keinen aktuellen Risikobezug mehr.`;
    if (review && packet.model.claim !== 'product_model')
        return 'Externes Standardmodell ist ohne qualifizierte Freigabe nicht als Prüfgrundlage verfügbar.';
    if (review && !packet.rationale.trim())
        return 'Begründung der Instrumenten- und Modellauswahl ergänzen.';
    return null;
}
