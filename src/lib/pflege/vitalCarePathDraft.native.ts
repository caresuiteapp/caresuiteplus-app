// Generated native presentation from src/lib/pflege/vitalCarePathDraft.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeLocalStorage as localStorage,nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import type { VitalCareEntry, VitalCareKind } from "./vitalCarePathPacket.native.ts";
type Context = {
    tenantId: string;
    clientId: string;
    measurementId: string;
    actorId: string;
};
type Draft = Readonly<{
    version: 1;
    context: Context;
    entry: VitalCareEntry;
    originalHeadId: string | null;
    reason: string;
    updatedAt: string;
}>;
const prefix = 'caresuite:pflege:vital-care-draft:v1:';
const key = (c: Context) => `${prefix}${c.tenantId}:${c.clientId}:${c.measurementId}:${c.actorId}`;
const storage = () => typeof localStorage === 'undefined' ? null : localStorage;
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const kinds = new Set<VitalCareKind>(['measurement_review', 'anomaly_response', 'control_review', 'case_resolution', 'correction']);
function scopedDraftIssue(c: Context, entry: VitalCareEntry, originalHeadId: string | null, reason: string) { if (![c.tenantId, c.clientId, c.measurementId, c.actorId].every(uuid) || !entry || !kinds.has(entry.kind) || entry.tenantId !== c.tenantId || entry.clientId !== c.clientId || entry.measurementId !== c.measurementId || originalHeadId !== null && !uuid(originalHeadId) || typeof reason !== 'string' || reason.length > 4000)
    return 'Vitalpfad-Entwurf ist nicht vollständig an aktuellen Pflegefall, Messung und Profil gebunden.'; try {
    if (JSON.stringify(entry).length > 100000)
        return 'Vitalpfad-Entwurf überschreitet den zulässigen lokalen Umfang.';
}
catch {
    return 'Vitalpfad-Entwurf ist nicht serialisierbar.';
} return null; }
export function saveVitalCareDraft(c: Context, entry: VitalCareEntry, originalHeadId: string | null, reason: string) { const issue = scopedDraftIssue(c, entry, originalHeadId, reason); if (issue)
    throw Error(issue); const target = storage(); if (!target)
    throw Error('Lokaler Vitalpfad-Entwurf ist nicht verfügbar.'); const draft: Draft = { version: 1, context: structuredClone(c), entry: structuredClone(entry), originalHeadId, reason, updatedAt: new Date().toISOString() }, serialized = JSON.stringify(draft); target.setItem(key(c), serialized); if (target.getItem(key(c)) !== serialized)
    throw Error('Lokaler Vitalpfad-Entwurf konnte nicht bestätigt werden.'); return structuredClone(draft); }
export function readVitalCareDraft(c: Context): Draft | null { try {
    const raw = storage()?.getItem(key(c));
    if (!raw || raw.length > 100000)
        return null;
    const d = JSON.parse(raw) as Draft;
    if (d.version !== 1 || JSON.stringify(d.context) !== JSON.stringify(c) || scopedDraftIssue(c, d.entry, d.originalHeadId, d.reason) || typeof d.updatedAt !== 'string' || !Number.isFinite(Date.parse(d.updatedAt)))
        return null;
    return structuredClone(d);
}
catch {
    return null;
} }
export function clearVitalCareDraft(c: Context) { try {
    storage()?.removeItem(key(c));
}
catch { /* best effort */ } }
