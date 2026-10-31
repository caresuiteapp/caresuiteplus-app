// Generated native presentation from src/lib/office/personnelWorkspaceReviewWorkflow.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeLocalStorage as localStorage,nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { commitPersonnelReview, confirmPersonnelReview } from "./personnelWorkspaceReviewRepository.supabase.native.ts";
import type { PersonnelReviewOriginal, PersonnelReviewPacket } from "./personnelWorkspaceReview.native.ts";
type Scope = Readonly<{
    tenantId: string;
    employeeId: string;
    actorId: string;
}>;
type Journal = Readonly<{
    version: 1;
    phase: 'prepared' | 'dispatched';
    packet: PersonnelReviewPacket;
}>;
type Result = {
    ok: true;
    data: PersonnelReviewOriginal;
} | {
    ok: false;
    error: string;
    uncertain?: boolean;
    rejected?: boolean;
};
const prefix = 'caresuite:office:personnel-review:v1:', key = (c: Scope) => prefix + c.tenantId + ':' + c.employeeId + ':' + c.actorId;
const storage = () => { if (typeof localStorage === 'undefined')
    throw Error('Dauerhaftes Personalprüfjournal ist in diesem Browser nicht verfügbar.'); return localStorage; };
function read(c: Scope): Journal | null { const raw = storage().getItem(key(c)); if (raw === null)
    return null; try {
    const j = JSON.parse(raw) as Journal;
    if (!j || j.version !== 1 || !['prepared', 'dispatched'].includes(j.phase) || j.packet?.tenantId !== c.tenantId || j.packet.employeeId !== c.employeeId || j.packet.actorId !== c.actorId || typeof j.packet.requestId !== 'string')
        throw Error();
    return j;
}
catch {
    throw Error('Das gespeicherte Personalprüfjournal ist unvollständig. Es bleibt erhalten; ein Ersatzwrite ist gesperrt.');
} }
function persist(j: Journal) { const s = storage(), raw = JSON.stringify(structuredClone(j)); s.setItem(key(j.packet), raw); if (s.getItem(key(j.packet)) !== raw)
    throw Error('Personalprüfjournal konnte nicht bestätigt werden.'); }
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
    throw Error('Browserweite Exklusivsperre fehlt; Personalfachprüfung bleibt gesperrt.'); return locks.request(name, { mode: 'exclusive', ifAvailable: true }, async (lock) => { if (!lock)
    throw Error('Ein anderer Tab bearbeitet diese Personalfachprüfung.'); return run(); }); }
export async function savePersonnelReviewDurably(p: PersonnelReviewPacket, current: () => boolean): Promise<Result> { const captured = structuredClone(p); try {
    return await locked(key(captured), async () => { if (!current())
        return { ok: false, error: 'Personalakte oder Rechtekontext hat gewechselt.' }; const previous = read(captured); if (previous?.phase === 'dispatched')
        return { ok: false, error: 'Eine frühere Personalfachprüfung ist noch ungeklärt.', uncertain: true }; if (previous)
        clear(captured); persist({ version: 1, phase: 'prepared', packet: captured }); if (!current())
        return { ok: false, error: 'Personalakte oder Rechtekontext hat gewechselt.' }; persist({ version: 1, phase: 'dispatched', packet: captured }); const result = await commitPersonnelReview(captured, current); if (!current())
        return { ok: false, error: 'Kontextwechsel nach Versand; ursprüngliche Prüfquittung erneut lesen.', uncertain: true }; if (result.ok) {
        clear(captured);
        return result;
    } if (result.rejected) {
        clear(captured);
        return { ok: false, error: result.error };
    } return { ok: false, error: result.error, uncertain: true }; });
}
catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : 'Personalfachprüfung konnte nicht bestätigt werden.', uncertain: true };
} }
export async function recoverPersonnelReview(c: Scope, current: () => boolean): Promise<Result | null> { try {
    return await locked(key(c), async () => { const journal = read(c); if (!journal)
        return null; if (journal.phase === 'prepared')
        return { ok: false, error: 'Eine vorbereitete Personalprüfanfrage wurde nicht gesendet. Sie bleibt erhalten.', uncertain: true }; if (!current())
        return { ok: false, error: 'Personalakte oder Rechtekontext hat gewechselt.', uncertain: true }; const result = await confirmPersonnelReview(journal.packet, current); if (!current())
        return { ok: false, error: 'Kontextwechsel während der Quittungsprüfung.', uncertain: true }; if (result.ok)
        clear(c); return result; });
}
catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : 'Personalprüfjournal konnte nicht gelesen werden.', uncertain: true };
} }
