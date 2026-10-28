// Generated native presentation from src/lib/clients/clientFinancingWorkspaceReviewWorkflow.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeLocalStorage as localStorage,nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { commitClientFinancingReview, confirmClientFinancingReview } from "./clientFinancingWorkspaceReviewRepository.supabase.native.ts";
import type { ClientFinancingReviewOriginal, ClientFinancingReviewPacket } from "./clientFinancingWorkspaceReview.native.ts";
type Scope = Readonly<{
    tenantId: string;
    clientId: string;
    actorId: string;
}>;
type Journal = Readonly<{
    version: 1;
    phase: 'prepared' | 'dispatched';
    packet: ClientFinancingReviewPacket;
}>;
type Result = {
    ok: true;
    data: ClientFinancingReviewOriginal;
} | {
    ok: false;
    error: string;
    uncertain?: boolean;
    rejected?: boolean;
};
const prefix = 'caresuite:office:client-financing-review:v1:', key = (c: Scope) => prefix + c.tenantId + ':' + c.clientId + ':' + c.actorId;
const storage = () => { if (typeof localStorage === 'undefined')
    throw Error('Dauerhaftes Vertrags- und Finanzierungsprüfjournal ist in diesem Browser nicht verfügbar.'); return localStorage; };
function read(c: Scope): Journal | null { const raw = storage().getItem(key(c)); if (raw === null)
    return null; try {
    const j = JSON.parse(raw) as Journal;
    if (!j || j.version !== 1 || !['prepared', 'dispatched'].includes(j.phase) || j.packet?.tenantId !== c.tenantId || j.packet.clientId !== c.clientId || j.packet.actorId !== c.actorId || typeof j.packet.requestId !== 'string')
        throw Error();
    return j;
}
catch {
    throw Error('Das gespeicherte Vertrags- und Finanzierungsprüfjournal ist unvollständig. Es bleibt erhalten; ein Ersatzwrite ist gesperrt.');
} }
function persist(j: Journal) { const s = storage(), raw = JSON.stringify(structuredClone(j)); s.setItem(key(j.packet), raw); if (s.getItem(key(j.packet)) !== raw)
    throw Error('Vertrags- und Finanzierungsprüfjournal konnte nicht bestätigt werden.'); }
function clear(c: Scope) { const s = storage(), name = key(c); s.removeItem(name); if (s.getItem(name) !== null)
    throw Error('Prüfquittung wurde gelesen, aber das Journal konnte nicht abgeschlossen werden.'); }
async function locked<T>(name: string, run: () => Promise<T>): Promise<T> { const locks = (globalThis.navigator as Navigator & {
    locks?: {
        request<T>(name: string, options: {
            mode: 'exclusive';
            ifAvailable: boolean;
        }, callback: (lock: unknown) => Promise<T>): Promise<T>;
    };
} | undefined)?.locks; if (!locks)
    throw Error('Browserweite Exklusivsperre fehlt; Vertrags- und Finanzierungsfachprüfung bleibt gesperrt.'); return locks.request(name, { mode: 'exclusive', ifAvailable: true }, async (lock) => { if (!lock)
    throw Error('Ein anderer Tab bearbeitet diese Vertrags- und Finanzierungsfachprüfung.'); return run(); }); }
export async function saveClientFinancingReviewDurably(p: ClientFinancingReviewPacket, current: () => boolean): Promise<Result> { const captured = structuredClone(p); try {
    return await locked(key(captured), async () => { if (!current())
        return { ok: false, error: 'Vertrags- und Finanzierungsakte oder Rechtekontext hat gewechselt.' }; const previous = read(captured); if (previous?.phase === 'dispatched')
        return { ok: false, error: 'Eine frühere Vertrags- und Finanzierungsfachprüfung ist noch ungeklärt.', uncertain: true }; if (previous)
        clear(captured); persist({ version: 1, phase: 'prepared', packet: captured }); if (!current())
        return { ok: false, error: 'Vertrags- und Finanzierungsakte oder Rechtekontext hat gewechselt.' }; persist({ version: 1, phase: 'dispatched', packet: captured }); const result = await commitClientFinancingReview(captured, current); if (!current())
        return { ok: false, error: 'Kontextwechsel nach Versand; ursprüngliche Prüfquittung erneut lesen.', uncertain: true }; if (result.ok) {
        clear(captured);
        return result;
    } if (result.rejected) {
        clear(captured);
        return { ok: false, error: result.error };
    } return { ok: false, error: result.error, uncertain: true }; });
}
catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : 'Vertrags- und Finanzierungsfachprüfung konnte nicht bestätigt werden.', uncertain: true };
} }
export async function recoverClientFinancingReview(c: Scope, current: () => boolean): Promise<Result | null> { try {
    return await locked(key(c), async () => { const journal = read(c); if (!journal)
        return null; if (journal.phase === 'prepared')
        return { ok: false, error: 'Eine vorbereitete Vertrags- und Finanzierungsprüfanfrage wurde nicht gesendet. Sie bleibt erhalten.', uncertain: true }; if (!current())
        return { ok: false, error: 'Vertrags- und Finanzierungsakte oder Rechtekontext hat gewechselt.', uncertain: true }; const result = await confirmClientFinancingReview(journal.packet, current); if (!current())
        return { ok: false, error: 'Kontextwechsel während der Quittungsprüfung.', uncertain: true }; if (result.ok)
        clear(c); return result; });
}
catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : 'Vertrags- und Finanzierungsprüfjournal konnte nicht gelesen werden.', uncertain: true };
} }
