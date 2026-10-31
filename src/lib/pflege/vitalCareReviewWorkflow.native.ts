// Generated native presentation from src/lib/pflege/vitalCareReviewWorkflow.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeLocalStorage as localStorage,nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { commitVitalCareReview, confirmVitalCareReview } from "./vitalCareReviewRepository.supabase.native.ts";
import type { VitalCareReviewOriginal, VitalCareReviewPacket } from "./vitalCareReview.native.ts";
type Scope = Readonly<{
    tenantId: string;
    clientId: string;
    measurementId: string;
    actorId: string;
}>;
type Journal = Readonly<{
    version: 1;
    phase: 'prepared' | 'dispatched';
    packet: VitalCareReviewPacket;
}>;
type Result = {
    ok: true;
    data: VitalCareReviewOriginal;
} | {
    ok: false;
    error: string;
    uncertain?: boolean;
    rejected?: boolean;
};
const prefix = 'caresuite:pflege:vital-care-review:v1:';
const key = (c: Scope) => prefix + c.tenantId + ':' + c.clientId + ':' + c.measurementId + ':' + c.actorId;
const storage = () => { if (typeof localStorage === 'undefined')
    throw Error('Dauerhaftes Vitalfachpruefjournal ist in diesem Browser nicht verfuegbar.'); return localStorage; };
function read(c: Scope): Journal | null { const raw = storage().getItem(key(c)); if (raw === null)
    return null; try {
    const j = JSON.parse(raw) as Journal;
    if (!j || j.version !== 1 || !['prepared', 'dispatched'].includes(j.phase) || j.packet?.tenantId !== c.tenantId || j.packet.clientId !== c.clientId || j.packet.measurementId !== c.measurementId || j.packet.actorId !== c.actorId || typeof j.packet.requestId !== 'string')
        throw Error();
    return j;
}
catch {
    throw Error('Das gespeicherte Vitalfachpruefjournal ist unvollstaendig. Es bleibt erhalten; ein Ersatzwrite ist gesperrt.');
} }
function persist(j: Journal) { const target = storage(), serialized = JSON.stringify(structuredClone(j)); target.setItem(key(j.packet), serialized); if (target.getItem(key(j.packet)) !== serialized)
    throw Error('Vitalfachpruefjournal konnte nicht bestaetigt werden.'); }
function clear(c: Scope) { const target = storage(), name = key(c); target.removeItem(name); if (target.getItem(name) !== null)
    throw Error('Die Pruefquittung wurde gelesen, aber das Journal konnte nicht abgeschlossen werden.'); }
async function locked<T>(name: string, run: () => Promise<T>): Promise<T> { const locks = (globalThis.navigator as Navigator & {
    locks?: {
        request<T>(name: string, options: {
            mode: 'exclusive';
            ifAvailable: boolean;
        }, callback: (lock: unknown) => Promise<T>): Promise<T>;
    };
} | undefined)?.locks; if (!locks)
    throw Error('Browserweite Exklusivsperre fehlt; Vitalfachpruefung bleibt gesperrt.'); return locks.request(name, { mode: 'exclusive', ifAvailable: true }, async (lock) => { if (!lock)
    throw Error('Ein anderer Tab bearbeitet diese Vitalfachpruefung.'); return run(); }); }
export async function saveVitalCareReviewDurably(p: VitalCareReviewPacket, current: () => boolean): Promise<Result> {
    const captured = structuredClone(p);
    try {
        return await locked(key(captured), async () => { if (!current())
            return { ok: false, error: 'Pflegefall, Messung oder Rechtekontext hat gewechselt.' }; const previous = read(captured); if (previous?.phase === 'dispatched')
            return { ok: false, error: 'Eine fruehere Vitalfachpruefung ist noch ungeklaert.', uncertain: true }; if (previous)
            clear(captured); persist({ version: 1, phase: 'prepared', packet: captured }); if (!current())
            return { ok: false, error: 'Pflegefall, Messung oder Rechtekontext hat gewechselt.' }; persist({ version: 1, phase: 'dispatched', packet: captured }); const result = await commitVitalCareReview(captured, current); if (!current())
            return { ok: false, error: 'Kontextwechsel nach Versand; urspruengliche Pruefquittung erneut lesen.', uncertain: true }; if (result.ok) {
            clear(captured);
            return result;
        } if (result.rejected) {
            clear(captured);
            return { ok: false, error: result.error };
        } return { ok: false, error: result.error, uncertain: true }; });
    }
    catch (cause) {
        return { ok: false, error: cause instanceof Error ? cause.message : 'Pruefjournal oder Sperre konnte nicht bestaetigt werden.', uncertain: true };
    }
}
export async function recoverVitalCareReview(c: Scope, current: () => boolean): Promise<Result | null> {
    try {
        return await locked(key(c), async () => { if (!current())
            return { ok: false, error: 'Pflegefall, Messung oder Rechtekontext hat gewechselt.', uncertain: true }; const journal = read(c); if (!journal)
            return null; if (journal.phase === 'prepared') {
            clear(c);
            return { ok: false, error: 'Nicht versandte lokale Vitalfachpruefanfrage wurde verworfen.' };
        } const result = await confirmVitalCareReview(structuredClone(journal.packet), current); if (!current())
            return { ok: false, error: 'Kontextwechsel waehrend der Pruefquittungslesung.', uncertain: true }; if (result.ok) {
            clear(c);
            return result;
        } return { ok: false, error: result.error, uncertain: true }; });
    }
    catch (cause) {
        return { ok: false, error: cause instanceof Error ? cause.message : 'Das urspruengliche Vitalfachpruefjournal bleibt ungeklaert.', uncertain: true };
    }
}
