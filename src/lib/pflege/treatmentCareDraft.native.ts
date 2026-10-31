// Generated native presentation from src/lib/pflege/treatmentCareDraft.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeLocalStorage as localStorage,nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import type { TreatmentCareEntry, TreatmentCarePacket } from "./treatmentCarePacket.native.ts";
type DraftContext = Pick<TreatmentCarePacket, 'tenantId' | 'clientId' | 'orderId' | 'actorId'>;
export type TreatmentCareLocalDraft = Readonly<{
    version: 1;
    context: DraftContext;
    entry: TreatmentCareEntry;
    originalHeadId: string | null;
    reason: string;
    updatedAt: string;
}>;
const prefix = 'caresuite:pflege:treatment-care:v1:draft:';
const storage = () => typeof localStorage === 'undefined' ? null : localStorage;
const key = (v: DraftContext) => `${prefix}${v.tenantId}:${v.clientId}:${v.orderId}:${v.actorId}`;
export function saveTreatmentCareDraft(c: DraftContext, entry: TreatmentCareEntry, originalHeadId: string | null, reason: string) { const target = storage(); if (!target)
    throw Error('Lokale Behandlungspflege-Entwürfe sind in diesem Browser nicht verfügbar.'); const draft: TreatmentCareLocalDraft = { version: 1, context: structuredClone(c), entry: structuredClone(entry), originalHeadId, reason, updatedAt: new Date().toISOString() }, serialized = JSON.stringify(draft); target.setItem(key(c), serialized); if (target.getItem(key(c)) !== serialized)
    throw Error('Lokaler Behandlungspflege-Entwurf konnte nicht bestätigt werden.'); return structuredClone(draft); }
export function readTreatmentCareDraft(c: DraftContext): TreatmentCareLocalDraft | null { try {
    const raw = storage()?.getItem(key(c));
    if (!raw)
        return null;
    const d = JSON.parse(raw) as TreatmentCareLocalDraft;
    return d.version === 1 && d.context?.tenantId === c.tenantId && d.context.clientId === c.clientId && d.context.orderId === c.orderId && d.context.actorId === c.actorId && d.entry?.clientId === c.clientId && d.entry.orderId === c.orderId && typeof d.reason === 'string' && typeof d.updatedAt === 'string' ? structuredClone(d) : null;
}
catch {
    return null;
} }
export function clearTreatmentCareDraft(c: DraftContext) { try {
    storage()?.removeItem(key(c));
}
catch { /* fail closed */ } }
