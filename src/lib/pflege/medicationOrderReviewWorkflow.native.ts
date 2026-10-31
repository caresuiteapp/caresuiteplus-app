// Generated native presentation from src/lib/pflege/medicationOrderReviewWorkflow.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeLocalStorage as localStorage,nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import type { RoleKey } from '@/types';
import type { MedicationOrderRevision } from "./medicationOrderRevisionDomain.native.ts";
import { medicationOrderReviewPacketIssue, medicationOrderApplyPacketIssue, type MedicationOrderReviewPacket, type MedicationOrderApplyPacket, type MedicationOrderReviewItem, type MedicationOrderReviewReceipt } from "./medicationOrderReviewDomain.native.ts";
import { commitMedicationOrderReview, applyMedicationOrderReview, confirmMedicationOrderReview, confirmMedicationOrderReviewApplication } from "./medicationOrderReviewService.native.ts";
import { sameWoundJson, woundUuid } from './woundCareDomain';
export type MedicationOrderReviewJournalScope = {
    tenantId: string;
    clientId: string;
    medicationId: string;
    actorId: string;
};
export type MedicationOrderReviewOperation = {
    kind: 'review';
    packet: MedicationOrderReviewPacket;
} | {
    kind: 'apply';
    packet: MedicationOrderApplyPacket;
};
export type MedicationOrderReviewJournal = {
    version: 1;
    phase: 'prepared' | 'dispatched';
    scope: MedicationOrderReviewJournalScope;
    operation: MedicationOrderReviewOperation;
};
type WorkflowResult = {
    ok: true;
    kind: 'review' | 'apply';
    data: MedicationOrderReviewReceipt | MedicationOrderRevision;
} | {
    ok: false;
    error: string;
    uncertain?: boolean;
    rejected?: boolean;
};
const prefix = 'caresuite:pflege:order-review:v1:';
const journalKey = (scope: MedicationOrderReviewJournalScope) => prefix + [scope.tenantId, scope.clientId, scope.medicationId, scope.actorId].join(':');
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
function validateScope(scope: MedicationOrderReviewJournalScope) { if (!object(scope) || !exact(scope, ['tenantId', 'clientId', 'medicationId', 'actorId']) || !Object.values(scope).every(woundUuid))
    throw Error('Eigener Bezug für den gespeicherten Prüfauftrag fehlt.'); }
function validateOperation(scope: MedicationOrderReviewJournalScope, operation: MedicationOrderReviewOperation) {
    if (!object(operation) || !exact(operation, ['kind', 'packet']) || !['review', 'apply'].includes(operation.kind) || !object(operation.packet))
        throw Error('Gespeicherter Prüfauftrag ist unvollständig.');
    if (operation.kind === 'review') {
        if (medicationOrderReviewPacketIssue(operation.packet) || !Object.entries(scope).every(([k, v]) => (operation.packet as unknown as Record<string, unknown>)[k] === v))
            throw Error('Gespeicherter Prüfauftrag gehört nicht zum eigenen Bezug.');
    }
    else if (medicationOrderApplyPacketIssue(operation.packet))
        throw Error('Gespeicherter Übertragungsauftrag ist unvollständig.');
}
function storage() { if (typeof localStorage === 'undefined')
    throw Error('Der Browser kann den Auftrag nicht dauerhaft sichern. Vor einer Übertragung muss der Browserspeicher verfügbar sein.'); return localStorage; }
function readJournal(scope: MedicationOrderReviewJournalScope): MedicationOrderReviewJournal | null {
    validateScope(scope);
    const raw = storage().getItem(journalKey(scope));
    if (raw === null)
        return null;
    try {
        const j: unknown = JSON.parse(raw);
        if (!object(j) || !exact(j, ['version', 'phase', 'scope', 'operation']) || j.version !== 1 || !['prepared', 'dispatched'].includes(String(j.phase)) || !sameWoundJson(j.scope, scope))
            throw Error();
        validateOperation(scope, j.operation as MedicationOrderReviewOperation);
        return j as unknown as MedicationOrderReviewJournal;
    }
    catch {
        throw Error('Ein gespeicherter Prüfauftrag ist unvollständig oder anders zugeordnet. Er bleibt erhalten; eine neue Anfrage ist gesperrt.');
    }
}
function persist(journal: MedicationOrderReviewJournal) { const target = storage(), key = journalKey(journal.scope), value = JSON.stringify(journal); target.setItem(key, value); if (target.getItem(key) !== value)
    throw Error('Der Auftrag konnte vor dem Versand nicht dauerhaft bestätigt werden.'); }
function clearExact(journal: MedicationOrderReviewJournal) { const target = storage(), key = journalKey(journal.scope), raw = target.getItem(key); if (raw !== JSON.stringify(journal))
    throw Error('Der gespeicherte Auftrag hat sich geändert und bleibt erhalten.'); target.removeItem(key); if (target.getItem(key) !== null)
    throw Error('Die Serverbestätigung liegt vor; der gespeicherte Auftrag konnte noch nicht abgeschlossen werden.'); }
async function locked<T>(scope: MedicationOrderReviewJournalScope, run: () => Promise<T>): Promise<T> {
    const locks = (globalThis.navigator as Navigator & {
        locks?: {
            request<T>(name: string, options: {
                mode: 'exclusive';
                ifAvailable: boolean;
            }, callback: (lock: unknown) => Promise<T>): Promise<T>;
        };
    } | undefined)?.locks;
    if (!locks)
        throw Error('Der Browser kann den Auftrag nicht zwischen geöffneten Tabs sperren. Eine neue Übertragung bleibt gesperrt.');
    return locks.request(journalKey(scope), { mode: 'exclusive', ifAvailable: true }, async (lock) => { if (!lock)
        throw Error('Ein anderer Tab bearbeitet diesen gespeicherten Auftrag.'); return run(); });
}
export function inspectMedicationOrderReviewJournal(scope: MedicationOrderReviewJournalScope): {
    ok: true;
    data: MedicationOrderReviewJournal | null;
} | {
    ok: false;
    error: string;
    uncertain: true;
} { try {
    return { ok: true, data: readJournal(structuredClone(scope)) };
}
catch (cause) {
    return { ok: false, uncertain: true, error: cause instanceof Error ? cause.message : 'Gespeicherter Auftrag kann nicht geprüft werden.' };
} }
async function confirm(j: MedicationOrderReviewJournal, role: RoleKey | null | undefined, current: () => boolean, item?: MedicationOrderReviewItem): Promise<WorkflowResult> {
    if (j.operation.kind === 'review') {
        const result = await confirmMedicationOrderReview(j.operation.packet, role, current);
        return result.ok ? { ok: true, kind: 'review', data: result.data } : { ...result, uncertain: true };
    }
    if (!item || item.request.revisionId !== j.operation.packet.revisionId || item.authorization?.id !== j.operation.packet.authorizationId)
        return { ok: false, uncertain: true, error: 'Der ursprüngliche Übertragungsbezug konnte nicht vollständig zurückgelesen werden.' };
    const result = await confirmMedicationOrderReviewApplication(item, j.operation.packet, j.scope.actorId, role, current);
    return result.ok ? { ok: true, kind: 'apply', data: result.data } : { ...result, uncertain: true };
}
export async function recoverMedicationOrderReviewDurably(inputScope: MedicationOrderReviewJournalScope, role: RoleKey | null | undefined, current: () => boolean, item?: MedicationOrderReviewItem): Promise<WorkflowResult | null> {
    const scope = structuredClone(inputScope);
    try {
        return await locked<WorkflowResult | null>(scope, async () => { if (!current())
            return { ok: false, uncertain: true, error: 'Ursprünglichen eigenen Prüfbezug erneut herstellen.' }; const journal = readJournal(scope); if (!journal)
            return null; const result = await confirm(journal, role, current, item); if (!current())
            return { ok: false, uncertain: true, error: 'Der eigene Bezug wurde während der Wiederherstellung geändert.' }; if (result.ok)
            clearExact(journal); return result; });
    }
    catch (cause) {
        return { ok: false, uncertain: true, error: cause instanceof Error ? cause.message : 'Der gespeicherte Auftrag bleibt ungeklärt.' };
    }
}
export async function saveMedicationOrderReviewDurably(inputScope: MedicationOrderReviewJournalScope, inputOperation: MedicationOrderReviewOperation, role: RoleKey | null | undefined, current: () => boolean, item?: MedicationOrderReviewItem): Promise<WorkflowResult> {
    const scope = structuredClone(inputScope), operation = structuredClone(inputOperation);
    let retained = false, dispatched = false;
    try {
        validateScope(scope);
        validateOperation(scope, operation);
        return await locked<WorkflowResult>(scope, async () => {
            if (!current())
                return { ok: false, error: 'Aktiven eigenen Prüfbezug bestätigen.' };
            let journal = readJournal(scope);
            retained = journal !== null;
            if (journal && !sameWoundJson(journal.operation, operation))
                return { ok: false, uncertain: true, error: 'Ein anderer eigener Prüfauftrag ist noch ungeklärt. Seinen Originalbeleg zuerst wiederherstellen.' };
            const previouslyDispatched = journal?.phase === 'dispatched';
            if (journal) {
                const restored = await confirm(journal, role, current, item);
                if (!current())
                    return { ok: false, uncertain: true, error: 'Eigener Bezug während der Bestätigung geändert.' };
                if (restored.ok) {
                    clearExact(journal);
                    return restored;
                }
            }
            else {
                journal = { version: 1, phase: 'prepared', scope, operation };
                persist(journal);
            }
            if (!current())
                return { ok: false, uncertain: true, error: 'Der vorbereitete eigene Auftrag bleibt erhalten; aktuellen Bezug wiederherstellen.' };
            journal = { ...journal, phase: 'dispatched' };
            persist(journal);
            dispatched = true;
            const result = operation.kind === 'review' ? await commitMedicationOrderReview(operation.packet, role, current) : item ? await applyMedicationOrderReview(item, operation.packet, scope.actorId, role, current) : { ok: false as const, uncertain: true, error: 'Ursprünglicher technischer Übertragungsbezug fehlt.' };
            if (!current())
                return { ok: false, uncertain: true, error: 'Eigener Bezug nach Versand geändert. Derselbe Auftrag bleibt erhalten.' };
            if (result.ok) {
                clearExact(journal);
                return { ok: true, kind: operation.kind, data: result.data };
            }
            if (!previouslyDispatched && result.uncertain !== true) {
                clearExact(journal);
                return { ok: false, rejected: true, error: result.error };
            }
            return { ok: false, uncertain: true, error: result.error };
        });
    }
    catch (cause) {
        return { ok: false, uncertain: retained || dispatched, error: cause instanceof Error ? cause.message : 'Der Prüfauftrag konnte nicht dauerhaft gesichert werden.' };
    }
}
