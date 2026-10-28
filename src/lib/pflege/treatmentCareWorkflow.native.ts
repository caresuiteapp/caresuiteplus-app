// Generated native presentation from src/lib/pflege/treatmentCareWorkflow.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeLocalStorage as localStorage,nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { commitTreatmentCarePacket, confirmTreatmentCarePacket } from "./treatmentCareRepository.supabase.native.ts";
import type { TreatmentCareOriginal, TreatmentCarePacket } from "./treatmentCarePacket.native.ts";
type Journal = Readonly<{
    version: 1;
    phase: 'prepared' | 'dispatched';
    packet: TreatmentCarePacket;
}>;
type Result = {
    ok: true;
    data: TreatmentCareOriginal;
} | {
    ok: false;
    error: string;
    uncertain?: boolean;
};
const prefix = 'caresuite:pflege:treatment-care:v1:';
const key = (v: Pick<TreatmentCarePacket, 'tenantId' | 'clientId' | 'orderId' | 'actorId'>) => `${prefix}${v.tenantId}:${v.clientId}:${v.orderId}:${v.actorId}`;
const storage = () => typeof localStorage === 'undefined' ? null : localStorage;
function persist(j: Journal) { const target = storage(); if (!target)
    throw Error('Dauerhaftes Behandlungspflege-Versandjournal ist in diesem Browser nicht verfügbar.'); const serialized = JSON.stringify(structuredClone(j)); target.setItem(key(j.packet), serialized); if (target.getItem(key(j.packet)) !== serialized)
    throw Error('Behandlungspflege-Versandjournal konnte nicht bestätigt werden.'); }
function read(c: Pick<TreatmentCarePacket, 'tenantId' | 'clientId' | 'orderId' | 'actorId'>): Journal | null { try {
    const raw = storage()?.getItem(key(c));
    if (!raw)
        return null;
    const j = JSON.parse(raw) as Journal;
    return j.version === 1 && ['prepared', 'dispatched'].includes(j.phase) && j.packet?.tenantId === c.tenantId && j.packet.clientId === c.clientId && j.packet.orderId === c.orderId && j.packet.actorId === c.actorId ? j : null;
}
catch {
    return null;
} }
function clear(c: Pick<TreatmentCarePacket, 'tenantId' | 'clientId' | 'orderId' | 'actorId'>) { try {
    storage()?.removeItem(key(c));
}
catch { /* fail closed */ } }
async function locked<T>(name: string, run: () => Promise<T>): Promise<T> { const locks = (globalThis.navigator as Navigator & {
    locks?: {
        request<T>(name: string, options: {
            mode: 'exclusive';
            ifAvailable: boolean;
        }, callback: (lock: unknown) => Promise<T>): Promise<T>;
    };
}).locks; if (!locks)
    throw Error('Browserweite Exklusivsperre fehlt; Behandlungspflegesicherung wird nicht bestätigt.'); return locks.request(name, { mode: 'exclusive', ifAvailable: true }, async (lock) => { if (!lock)
    throw Error('Ein anderer Tab bearbeitet diesen Behandlungsweg.'); return run(); }); }
export async function saveTreatmentCareDurably(p: TreatmentCarePacket, isCurrent: () => boolean): Promise<Result> { const captured = structuredClone(p); return locked(key(captured), async () => { const previous = read(captured); if (previous?.phase === 'dispatched')
    return { ok: false, error: 'Ein früherer Behandlungspflege-Schreibvorgang ist noch ungeklärt.', uncertain: true }; if (previous)
    clear(captured); persist({ version: 1, phase: 'prepared', packet: captured }); if (!isCurrent()) {
    clear(captured);
    return { ok: false, error: 'Pflegefall, Verordnung oder Rechtekontext hat gewechselt.' };
} persist({ version: 1, phase: 'dispatched', packet: captured }); const result = await commitTreatmentCarePacket(captured, isCurrent); if (result.ok) {
    clear(captured);
    return result;
} if (result.rejected || result.uncertain !== true) {
    clear(captured);
    return { ok: false, error: result.error };
} return { ok: false, error: result.error, uncertain: true }; }); }
export async function recoverTreatmentCare(c: Pick<TreatmentCarePacket, 'tenantId' | 'clientId' | 'orderId' | 'actorId'>, isCurrent: () => boolean): Promise<Result | null> { return locked(key(c), async () => { const journal = read(c); if (!journal)
    return null; if (journal.phase === 'prepared') {
    clear(c);
    return { ok: false, error: 'Nicht versandte lokale Behandlungspflegeanfrage wurde verworfen.' };
} const result = await confirmTreatmentCarePacket(journal.packet, isCurrent); if (result.ok) {
    clear(c);
    return result;
} return { ok: false, error: result.error, uncertain: true }; }); }
