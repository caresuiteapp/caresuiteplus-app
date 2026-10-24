// Generated native presentation from src/lib/office/continuity/clientCareContinuityWorkflow.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeWindow as window} from '@/lib/platform/nativeWorkflowEnvironment.native';
import type { ServiceResult } from '@/types';
import type { ClientServiceInterruption, ClientServiceInterruptionKind } from '@/types/modules/clientCareContinuity';
import { beginClientServiceInterruption, confirmClientServiceInterruption, endClientServiceInterruption, } from "./clientCareContinuityRepository.supabase.native.ts";
type StartOriginal = Readonly<{
    tenantId: string;
    clientId: string;
    actorId: string;
    requestId: string;
    expectedClientUpdatedAt: string;
    kind: ClientServiceInterruptionKind;
    reason: string;
    plannedStartAt: string;
    plannedEndAt: string | null;
    actualStartAt: string;
}>;
type EndOriginal = Readonly<{
    tenantId: string;
    clientId: string;
    actorId: string;
    interruptionId: string;
    requestId: string;
    endRequestId: string;
    expectedUpdatedAt: string;
    actualEndAt: string;
    endReason: string;
}>;
type Journal = {
    phase: 'start' | 'end';
    original: StartOriginal | EndOriginal;
};
const prefix = 'caresuite:client-service-continuity:v1:';
function key(tenantId: string, clientId: string): string { return `${prefix}${tenantId}:${clientId}`; }
function storage(): Storage | null { try {
    return typeof window === 'undefined' ? null : window.localStorage;
}
catch {
    return null;
} }
function writeJournal(tenantId: string, clientId: string, journal: Journal): boolean {
    const target = storage();
    if (!target)
        return false;
    try {
        target.setItem(key(tenantId, clientId), JSON.stringify(journal));
        return true;
    }
    catch {
        return false;
    }
}
function clearJournal(tenantId: string, clientId: string): void { try {
    storage()?.removeItem(key(tenantId, clientId));
}
catch { /* closed */ } }
function readJournal(tenantId: string, clientId: string): Journal | null {
    try {
        const raw = storage()?.getItem(key(tenantId, clientId));
        if (!raw)
            return null;
        const parsed = JSON.parse(raw) as Journal;
        return parsed && ['start', 'end'].includes(parsed.phase) && parsed.original && typeof parsed.original === 'object' ? parsed : null;
    }
    catch {
        return null;
    }
}
export async function startInterruptionDurably(original: StartOriginal): Promise<ServiceResult<ClientServiceInterruption>> {
    const captured = Object.freeze({ ...original });
    if (!writeJournal(captured.tenantId, captured.clientId, { phase: 'start', original: captured })) {
        return { ok: false, error: 'Der Versandjournal-Eintrag konnte nicht dauerhaft gespeichert werden; es wurde nichts gesendet.' };
    }
    const result = await beginClientServiceInterruption(captured);
    if (result.ok)
        clearJournal(captured.tenantId, captured.clientId);
    return result;
}
export async function endInterruptionDurably(original: EndOriginal): Promise<ServiceResult<ClientServiceInterruption>> {
    const captured = Object.freeze({ ...original });
    if (!writeJournal(captured.tenantId, captured.clientId, { phase: 'end', original: captured })) {
        return { ok: false, error: 'Der Rückkehrjournal-Eintrag konnte nicht dauerhaft gespeichert werden; es wurde nichts gesendet.' };
    }
    const result = await endClientServiceInterruption(captured);
    if (result.ok)
        clearJournal(captured.tenantId, captured.clientId);
    return result;
}
export async function recoverInterruptionJournal(tenantId: string, clientId: string, actorId: string): Promise<ServiceResult<ClientServiceInterruption> | null> {
    const journal = readJournal(tenantId, clientId);
    if (!journal)
        return null;
    if (journal.original.tenantId !== tenantId || journal.original.clientId !== clientId || journal.original.actorId !== actorId) {
        return { ok: false, error: 'Ein fremder oder veralteter Unterbrechungsvorgang bleibt gesperrt.' };
    }
    if (journal.phase === 'start') {
        const original = journal.original as StartOriginal;
        const result = await confirmClientServiceInterruption({ tenantId, clientId, actorId, requestId: original.requestId });
        if (result.ok)
            clearJournal(tenantId, clientId);
        return result;
    }
    const original = journal.original as EndOriginal;
    const result = await confirmClientServiceInterruption({ tenantId, clientId, actorId, requestId: original.requestId });
    if (result.ok && result.data.status === 'ended' && result.data.actualEndAt === original.actualEndAt && result.data.endReason === original.endReason.trim()) {
        clearJournal(tenantId, clientId);
        return result;
    }
    return { ok: false, error: 'Die begonnene Rückkehr ist nicht durch eine exakt passende native Quittung bestätigt.' };
}
export const clientCareContinuityJournal = Object.freeze({ readJournal, clearJournal });
