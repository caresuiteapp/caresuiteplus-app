// Generated native presentation from src/lib/careAssessment/counselingCoordinationReviewWorkflow.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeLocalStorage as localStorage,nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { commitCounselingCoordinationReview, confirmCounselingCoordinationReview } from "./counselingCoordinationReviewRepository.supabase.native.ts";
import type { CounselingCoordinationReviewOriginal, CounselingCoordinationReviewPacket } from "./counselingCoordinationReview.native.ts";
type Scope = Readonly<{
    tenantId: string;
    clientId: string;
    assessmentId: string;
    actorId: string;
}>;
type Journal = Readonly<{
    version: 1;
    phase: 'prepared' | 'dispatched';
    packet: CounselingCoordinationReviewPacket;
}>;
type Result = {
    ok: true;
    data: CounselingCoordinationReviewOriginal;
} | {
    ok: false;
    error: string;
    uncertain?: boolean;
    rejected?: boolean;
};
const prefix = 'caresuite:care-assessment:counseling-coordination-review:v1:', key = (c: Scope) => prefix + c.tenantId + ':' + c.clientId + ':' + c.assessmentId + ':' + c.actorId;
const storage = () => { if (typeof localStorage === 'undefined')
    throw Error('Dauerhaftes Beratungsfachprüfjournal ist in diesem Browser nicht verfügbar.'); return localStorage; };
function read(c: Scope): Journal | null { const raw = storage().getItem(key(c)); if (raw === null)
    return null; try {
    const j = JSON.parse(raw) as Journal;
    if (!j || j.version !== 1 || !['prepared', 'dispatched'].includes(j.phase) || j.packet?.tenantId !== c.tenantId || j.packet.clientId !== c.clientId || j.packet.assessmentId !== c.assessmentId || j.packet.actorId !== c.actorId || typeof j.packet.requestId !== 'string')
        throw Error();
    return j;
}
catch {
    throw Error('Das gespeicherte Beratungsfachprüfjournal ist unvollständig. Es bleibt erhalten; ein Ersatzwrite ist gesperrt.');
} }
function persist(j: Journal) { const s = storage(), raw = JSON.stringify(structuredClone(j)); s.setItem(key(j.packet), raw); if (s.getItem(key(j.packet)) !== raw)
    throw Error('Beratungsfachprüfjournal konnte nicht bestätigt werden.'); }
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
    throw Error('Browserweite Exklusivsperre fehlt; Beratungsfachprüfung bleibt gesperrt.'); return locks.request(name, { mode: 'exclusive', ifAvailable: true }, async (lock) => { if (!lock)
    throw Error('Ein anderer Tab bearbeitet diese Beratungsfachprüfung.'); return run(); }); }
export async function saveCounselingCoordinationReviewDurably(p: CounselingCoordinationReviewPacket, current: () => boolean): Promise<Result> { const captured = structuredClone(p); try {
    return await locked(key(captured), async () => { if (!current())
        return { ok: false, error: 'Pflegefall, Assessment oder Rechtekontext hat gewechselt.' }; const previous = read(captured); if (previous?.phase === 'dispatched')
        return { ok: false, error: 'Eine frühere Beratungsfachprüfung ist noch ungeklärt.', uncertain: true }; if (previous)
        clear(captured); persist({ version: 1, phase: 'prepared', packet: captured }); if (!current())
        return { ok: false, error: 'Pflegefall, Assessment oder Rechtekontext hat gewechselt.' }; persist({ version: 1, phase: 'dispatched', packet: captured }); const result = await commitCounselingCoordinationReview(captured, current); if (!current())
        return { ok: false, error: 'Kontextwechsel nach Versand; ursprüngliche Prüfquittung erneut lesen.', uncertain: true }; if (result.ok) {
        clear(captured);
        return result;
    } if (result.rejected) {
        clear(captured);
        return { ok: false, error: result.error };
    } return { ok: false, error: result.error, uncertain: true }; });
}
catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : 'Prüfjournal oder Sperre konnte nicht bestätigt werden.', uncertain: true };
} }
export async function recoverCounselingCoordinationReview(c: Scope, current: () => boolean): Promise<Result | null> { try {
    return await locked(key(c), async () => { if (!current())
        return { ok: false, error: 'Pflegefall, Assessment oder Rechtekontext hat gewechselt.', uncertain: true }; const journal = read(c); if (!journal)
        return null; if (journal.phase === 'prepared') {
        clear(c);
        return { ok: false, error: 'Nicht versandte lokale Beratungsfachprüfanfrage wurde verworfen.' };
    } const result = await confirmCounselingCoordinationReview(structuredClone(journal.packet), current); if (!current())
        return { ok: false, error: 'Kontextwechsel während der Prüfquittungslesung.', uncertain: true }; if (result.ok) {
        clear(c);
        return result;
    } return { ok: false, error: result.error, uncertain: true }; });
}
catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : 'Ursprüngliches Beratungsfachprüfjournal bleibt ungeklärt.', uncertain: true };
} }
